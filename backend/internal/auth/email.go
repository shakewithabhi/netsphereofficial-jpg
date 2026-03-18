package auth

import (
	"fmt"
	"log/slog"
	"net/smtp"

	"github.com/bytebox/backend/internal/platform/config"
)

// EmailSender sends transactional emails via SMTP.
type EmailSender struct {
	host    string
	port    int
	from    string
	password string
	baseURL string
}

// NewEmailSender creates a new EmailSender. If SMTP host is empty, sending is a no-op.
func NewEmailSender(cfg config.SMTPConfig, baseURL string) *EmailSender {
	return &EmailSender{
		host:     cfg.Host,
		port:     cfg.Port,
		from:     cfg.From,
		password: cfg.Password,
		baseURL:  baseURL,
	}
}

// SendVerificationEmail sends an email verification link to the user.
func (e *EmailSender) SendVerificationEmail(to, token string) error {
	if e.host == "" {
		slog.Info("SMTP not configured, skipping verification email", "to", to)
		return nil
	}

	verifyURL := fmt.Sprintf("%s/verify-email?token=%s", e.baseURL, token)
	subject := "Verify your ByteBox email"
	body := fmt.Sprintf(
		"Hello,\r\n\r\nPlease verify your email address by clicking the link below:\r\n\r\n%s\r\n\r\nThis link will expire in 24 hours.\r\n\r\nIf you did not create a ByteBox account, you can safely ignore this email.\r\n\r\n- The ByteBox Team",
		verifyURL,
	)

	return e.send(to, subject, body)
}

// SendPasswordResetEmail sends a password reset link to the user.
func (e *EmailSender) SendPasswordResetEmail(to, token string) error {
	if e.host == "" {
		slog.Info("SMTP not configured, skipping password reset email", "to", to)
		return nil
	}

	resetURL := fmt.Sprintf("%s/reset-password?token=%s", e.baseURL, token)
	subject := "Reset your ByteBox password"
	body := fmt.Sprintf(
		"Hello,\r\n\r\nYou requested a password reset. Click the link below to set a new password:\r\n\r\n%s\r\n\r\nThis link will expire in 1 hour.\r\n\r\nIf you did not request this, you can safely ignore this email.\r\n\r\n- The ByteBox Team",
		resetURL,
	)

	return e.send(to, subject, body)
}

func (e *EmailSender) send(to, subject, body string) error {
	msg := fmt.Sprintf(
		"From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n%s",
		e.from, to, subject, body,
	)

	addr := fmt.Sprintf("%s:%d", e.host, e.port)
	auth := smtp.PlainAuth("", e.from, e.password, e.host)

	if err := smtp.SendMail(addr, auth, e.from, []string{to}, []byte(msg)); err != nil {
		slog.Error("failed to send email", "error", err, "to", to, "subject", subject)
		return fmt.Errorf("send email: %w", err)
	}

	slog.Info("email sent", "to", to, "subject", subject)
	return nil
}
