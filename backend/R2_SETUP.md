# Cloudflare R2 setup

Create a private bucket for identity and business-verification documents. Create an R2 S3 API token with Object Read & Write access scoped only to that bucket, then copy the four `R2_*` values from `.env.example` into `.env`.

Browser uploads use five-minute presigned `PUT` URLs. Add this CORS policy to the bucket, replacing the origins with the deployed frontend domains:

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://your-app.example"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Keep the bucket private. Do not add R2 credentials to the frontend environment. Files are restricted to PDF, JPEG, PNG, or WebP and 10 MB each; future admin document previews should use short-lived backend-generated `GET` URLs.
