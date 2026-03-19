package billing

const (
	GB = int64(1024 * 1024 * 1024)
)

var Plans = map[string]PlanConfig{
	"free":    {Name: "Free", SoftStorageLimit: 15 * GB, PriceMonthly: 0, StripePriceID: ""},
	"pro":     {Name: "Pro", SoftStorageLimit: 100 * GB, PriceMonthly: 4900, StripePriceID: ""},
	"premium": {Name: "Premium", SoftStorageLimit: 1024 * GB, PriceMonthly: 9900, StripePriceID: ""},
}

// SetStripePriceIDs sets the Stripe price IDs from configuration.
// Must be called during application startup.
func SetStripePriceIDs(pro, premium string) {
	if p, ok := Plans["pro"]; ok {
		p.StripePriceID = pro
		Plans["pro"] = p
	}
	if p, ok := Plans["premium"]; ok {
		p.StripePriceID = premium
		Plans["premium"] = p
	}
}

// GetPlan returns the plan config for the given key, or nil if not found.
func GetPlan(key string) *PlanConfig {
	plan, ok := Plans[key]
	if !ok {
		return nil
	}
	return &plan
}

// ListPlans returns all available plans as a slice of PlanResponse.
func ListPlans() []PlanResponse {
	order := []string{"free", "pro", "premium"}
	result := make([]PlanResponse, 0, len(order))
	for _, key := range order {
		p := Plans[key]
		result = append(result, PlanResponse{
			Key:              key,
			Name:             p.Name,
			SoftStorageLimit: p.SoftStorageLimit,
			PriceMonthly:     p.PriceMonthly,
		})
	}
	return result
}
