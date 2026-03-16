package auth

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
)

// encryptTOTPSecret encrypts a TOTP secret using AES-256-GCM.
func encryptTOTPSecret(keyHex string, plaintext string) ([]byte, error) {
	key, err := deriveKey(keyHex)
	if err != nil {
		return nil, err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("new cipher: %w", err)
	}

	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("new gcm: %w", err)
	}

	nonce := make([]byte, aesGCM.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, fmt.Errorf("generate nonce: %w", err)
	}

	return aesGCM.Seal(nonce, nonce, []byte(plaintext), nil), nil
}

// decryptTOTPSecret decrypts a TOTP secret encrypted with AES-256-GCM.
func decryptTOTPSecret(keyHex string, ciphertext []byte) (string, error) {
	key, err := deriveKey(keyHex)
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("new cipher: %w", err)
	}

	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("new gcm: %w", err)
	}

	nonceSize := aesGCM.NonceSize()
	if len(ciphertext) < nonceSize {
		return "", fmt.Errorf("ciphertext too short")
	}

	nonce, ct := ciphertext[:nonceSize], ciphertext[nonceSize:]
	plaintext, err := aesGCM.Open(nil, nonce, ct, nil)
	if err != nil {
		return "", fmt.Errorf("decrypt: %w", err)
	}

	return string(plaintext), nil
}

// deriveKey derives a 32-byte key from the hex-encoded key string.
// If the key is already 32 bytes hex (64 chars), use it directly.
// Otherwise, hash it with SHA-256.
func deriveKey(keyHex string) ([]byte, error) {
	if keyHex == "" {
		// Use a deterministic dev key — NOT for production
		hash := sha256.Sum256([]byte("bytebox-dev-totp-key"))
		return hash[:], nil
	}

	key, err := hex.DecodeString(keyHex)
	if err != nil {
		// If not valid hex, hash the string
		hash := sha256.Sum256([]byte(keyHex))
		return hash[:], nil
	}

	if len(key) != 32 {
		hash := sha256.Sum256(key)
		return hash[:], nil
	}

	return key, nil
}

// generateRecoveryCode generates a random recovery code in the format XXXX-XXXX.
func generateRecoveryCode() (string, error) {
	b := make([]byte, 4)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return fmt.Sprintf("%s-%s", hex.EncodeToString(b[:2]), hex.EncodeToString(b[2:])), nil
}

// hashRecoveryCode returns the SHA-256 hex digest of a recovery code.
func hashRecoveryCode(code string) string {
	h := sha256.Sum256([]byte(code))
	return hex.EncodeToString(h[:])
}
