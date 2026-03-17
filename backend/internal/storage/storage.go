package storage

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log/slog"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	s3types "github.com/aws/aws-sdk-go-v2/service/s3/types"

	"github.com/bytebox/backend/internal/platform/config"
)

type Client struct {
	s3     *s3.Client
	presig *s3.PresignClient
	cfg    config.StorageConfig
}

func New(cfg config.StorageConfig) (*Client, error) {
	makeConfig := func(endpoint string) (aws.Config, error) {
		resolver := aws.EndpointResolverWithOptionsFunc(
			func(service, region string, options ...any) (aws.Endpoint, error) {
				return aws.Endpoint{
					URL:               endpoint,
					SigningRegion:      cfg.Region,
					HostnameImmutable: true,
				}, nil
			},
		)
		return awsconfig.LoadDefaultConfig(context.Background(),
			awsconfig.WithEndpointResolverWithOptions(resolver),
			awsconfig.WithCredentialsProvider(
				credentials.NewStaticCredentialsProvider(cfg.AccessKeyID, cfg.SecretAccessKey, ""),
			),
			awsconfig.WithRegion(cfg.Region),
		)
	}

	awsCfg, err := makeConfig(cfg.Endpoint)
	if err != nil {
		return nil, fmt.Errorf("load aws config: %w", err)
	}

	s3Client := s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		o.RequestChecksumCalculation = aws.RequestChecksumCalculationWhenRequired
		o.UsePathStyle = true
	})

	// Presign client uses public endpoint so URLs are accessible from outside Docker
	presignEndpoint := cfg.Endpoint
	if cfg.PublicEndpoint != "" {
		presignEndpoint = cfg.PublicEndpoint
	}
	presignCfg, err := makeConfig(presignEndpoint)
	if err != nil {
		return nil, fmt.Errorf("load presign config: %w", err)
	}
	presignS3 := s3.NewFromConfig(presignCfg, func(o *s3.Options) {
		o.RequestChecksumCalculation = aws.RequestChecksumCalculationWhenRequired
		o.UsePathStyle = true
	})
	presigClient := s3.NewPresignClient(presignS3)

	slog.Info("storage connected", "endpoint", cfg.Endpoint, "public_endpoint", presignEndpoint)

	return &Client{
		s3:     s3Client,
		presig: presigClient,
		cfg:    cfg,
	}, nil
}

func (c *Client) Upload(ctx context.Context, bucket, key string, body io.Reader, contentType string, size int64) error {
	// Read into memory so the body is seekable (required by AWS SDK v2 over HTTP).
	data, err := io.ReadAll(body)
	if err != nil {
		return fmt.Errorf("read upload body: %w", err)
	}

	_, err = c.s3.PutObject(ctx, &s3.PutObjectInput{
		Bucket:        aws.String(bucket),
		Key:           aws.String(key),
		Body:          bytes.NewReader(data),
		ContentType:   aws.String(contentType),
		ContentLength: aws.Int64(int64(len(data))),
	})
	if err != nil {
		return fmt.Errorf("upload object: %w", err)
	}
	return nil
}

func (c *Client) Delete(ctx context.Context, bucket, key string) error {
	_, err := c.s3.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return fmt.Errorf("delete object: %w", err)
	}
	return nil
}

func (c *Client) Copy(ctx context.Context, bucket, srcKey, dstKey string) error {
	copySource := fmt.Sprintf("%s/%s", bucket, srcKey)
	_, err := c.s3.CopyObject(ctx, &s3.CopyObjectInput{
		Bucket:     aws.String(bucket),
		CopySource: aws.String(copySource),
		Key:        aws.String(dstKey),
	})
	if err != nil {
		return fmt.Errorf("copy object: %w", err)
	}
	return nil
}

func (c *Client) PresignGetURL(ctx context.Context, bucket, key string, expiry time.Duration) (string, error) {
	resp, err := c.presig.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(key),
	}, s3.WithPresignExpires(expiry))
	if err != nil {
		return "", fmt.Errorf("presign get: %w", err)
	}
	return resp.URL, nil
}

func (c *Client) PresignPutURL(ctx context.Context, bucket, key, contentType string, expiry time.Duration) (string, error) {
	resp, err := c.presig.PresignPutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(bucket),
		Key:         aws.String(key),
		ContentType: aws.String(contentType),
	}, s3.WithPresignExpires(expiry))
	if err != nil {
		return "", fmt.Errorf("presign put: %w", err)
	}
	return resp.URL, nil
}

// Multipart upload operations

type MultipartUpload struct {
	UploadID string
	Key      string
}

type CompletedPart struct {
	PartNumber int32
	ETag       string
}

func (c *Client) CreateMultipartUpload(ctx context.Context, bucket, key, contentType string) (*MultipartUpload, error) {
	resp, err := c.s3.CreateMultipartUpload(ctx, &s3.CreateMultipartUploadInput{
		Bucket:      aws.String(bucket),
		Key:         aws.String(key),
		ContentType: aws.String(contentType),
	})
	if err != nil {
		return nil, fmt.Errorf("create multipart upload: %w", err)
	}
	return &MultipartUpload{
		UploadID: *resp.UploadId,
		Key:      key,
	}, nil
}

func (c *Client) PresignUploadPart(ctx context.Context, bucket, key, uploadID string, partNumber int32, expiry time.Duration) (string, error) {
	resp, err := c.presig.PresignUploadPart(ctx, &s3.UploadPartInput{
		Bucket:     aws.String(bucket),
		Key:        aws.String(key),
		UploadId:   aws.String(uploadID),
		PartNumber: aws.Int32(partNumber),
	}, s3.WithPresignExpires(expiry))
	if err != nil {
		return "", fmt.Errorf("presign upload part: %w", err)
	}
	return resp.URL, nil
}

func (c *Client) CompleteMultipartUpload(ctx context.Context, bucket, key, uploadID string, parts []CompletedPart) error {
	s3Parts := make([]s3types.CompletedPart, len(parts))
	for i, p := range parts {
		s3Parts[i] = s3types.CompletedPart{
			PartNumber: aws.Int32(p.PartNumber),
			ETag:       aws.String(p.ETag),
		}
	}
	_, err := c.s3.CompleteMultipartUpload(ctx, &s3.CompleteMultipartUploadInput{
		Bucket:   aws.String(bucket),
		Key:      aws.String(key),
		UploadId: aws.String(uploadID),
		MultipartUpload: &s3types.CompletedMultipartUpload{
			Parts: s3Parts,
		},
	})
	if err != nil {
		return fmt.Errorf("complete multipart upload: %w", err)
	}
	return nil
}

func (c *Client) AbortMultipartUpload(ctx context.Context, bucket, key, uploadID string) error {
	_, err := c.s3.AbortMultipartUpload(ctx, &s3.AbortMultipartUploadInput{
		Bucket:   aws.String(bucket),
		Key:      aws.String(key),
		UploadId: aws.String(uploadID),
	})
	if err != nil {
		return fmt.Errorf("abort multipart upload: %w", err)
	}
	return nil
}

func (c *Client) BucketFiles() string  { return c.cfg.BucketFiles }
func (c *Client) BucketThumbs() string { return c.cfg.BucketThumbs }
func (c *Client) BucketTemp() string   { return c.cfg.BucketTemp }
func (c *Client) PresignExpiry() time.Duration { return c.cfg.PresignExpiry }
