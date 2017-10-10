const config = (S3Domain, CloudFlareDomain, CallerReference, OriginId) => ({
  "CallerReference": CallerReference || String(new Date().getTime()), // This is too crazy what do you Amazon dev thinking :|
  "Aliases": {
    "Quantity": 1,
    "Items": [CloudFlareDomain]
  },
  "DefaultRootObject": "",
  "Origins": {
    "Items": [
      {
        "OriginPath": `/${S3Domain.split('/')[1]}`,
        "CustomOriginConfig": {
          "OriginSslProtocols": {
            "Items": [
              "TLSv1",
              "TLSv1.1",
              "TLSv1.2"
            ],
            "Quantity": 3
          },
          "OriginProtocolPolicy": "http-only",
          "OriginReadTimeout": 30,
          "HTTPPort": 80,
          "HTTPSPort": 443,
          "OriginKeepaliveTimeout": 5
        },
        "CustomHeaders": {
          "Quantity": 0
        },
        "Id": OriginId || S3Domain,
        "DomainName": S3Domain.split('/')[0]
      }
    ],
    "Quantity": 1
  },
  "DefaultCacheBehavior": {
    "TrustedSigners": {
      "Enabled": false,
      "Quantity": 0
    },
    "LambdaFunctionAssociations": {
      "Quantity": 0
    },
    "TargetOriginId": OriginId || S3Domain,
    "ViewerProtocolPolicy": "allow-all",
    "ForwardedValues": {
      "Headers": {
        "Quantity": 0
      },
      "Cookies": {
        "Forward": "none"
      },
      "QueryStringCacheKeys": {
        "Quantity": 0
      },
      "QueryString": false
    },
    "MaxTTL": 31536000,
    "SmoothStreaming": false,
    "DefaultTTL": 86400,
    "AllowedMethods": {
      "Items": [
        "HEAD",
        "GET"
      ],
      "CachedMethods": {
        "Items": [
          "HEAD",
          "GET"
        ],
        "Quantity": 2
      },
      "Quantity": 2
    },
    "MinTTL": 0,
    "Compress": false
  },
  "CacheBehaviors": {
    "Quantity": 0
  },
  "CustomErrorResponses": {
    "Items": [
      {
        "ErrorCode": 404,
        "ResponsePagePath": "/index.html",
        "ResponseCode": "200",
        "ErrorCachingMinTTL": 300
      }
    ],
    "Quantity": 1
  },
  "Comment": "",
  "Logging": {
    "Enabled": false,
    "IncludeCookies": true,
    "Bucket": "",
    "Prefix": ""
  },
  "PriceClass": "PriceClass_All",
  "Enabled": true,
  "ViewerCertificate": {
    "CloudFrontDefaultCertificate": true,
    "MinimumProtocolVersion": "TLSv1",
    "CertificateSource": "cloudfront"
  },
  "Restrictions": {
    "GeoRestriction": {
      "RestrictionType": "none",
      "Quantity": 0
    }
  },
  "WebACLId": "",
  "HttpVersion": "http2",
  "IsIPV6Enabled": true,
});

module.exports = config;
