package common

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/go-playground/validator/v10"
)

var validate = validator.New()

func DecodeAndValidate(r *http.Request, dst any) error {
	if err := json.NewDecoder(r.Body).Decode(dst); err != nil {
		return ErrBadRequest("invalid request body")
	}

	if err := validate.Struct(dst); err != nil {
		if validationErrors, ok := err.(validator.ValidationErrors); ok {
			var msgs []string
			for _, e := range validationErrors {
				msgs = append(msgs, fmt.Sprintf("%s: %s", e.Field(), e.Tag()))
			}
			return ErrBadRequest(strings.Join(msgs, "; "))
		}
		return ErrBadRequest("validation failed")
	}

	return nil
}
