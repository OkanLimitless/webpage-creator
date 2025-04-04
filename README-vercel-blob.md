# Vercel Blob Storage for Screenshots

This project uses Vercel Blob Storage to store screenshots generated via ScreenshotMachine.

## Setup

1. **Install the Vercel Blob Storage package**:
   ```bash
   npm install @vercel/blob
   ```

2. **Set up the BLOB_READ_WRITE_TOKEN**:
   
   a. Go to your Vercel project dashboard
   b. Navigate to Settings > Environment Variables
   c. Add a new Environment Variable:
      - Name: `BLOB_READ_WRITE_TOKEN`
      - Value: [Create a new token in the Vercel dashboard]
   d. Make sure the token has read/write permissions

3. **Add to your .env.local file**:
   ```
   BLOB_READ_WRITE_TOKEN=your_vercel_blob_token
   ```

## Usage

The system now automatically:

1. Takes screenshots using ScreenshotMachine
2. Uploads those screenshots to Vercel Blob Storage
3. Returns permanent URLs that can be stored in the database

## How it Works

1. The `takeScreenshots` function is called with a URL and ID
2. ScreenshotMachine generates desktop and mobile screenshots
3. The screenshots are uploaded to Vercel Blob Storage
4. Permanent, publicly accessible URLs are returned

## Testing

To test the Vercel Blob Storage integration:

```bash
npm run test:blob
```

## Troubleshooting

If images are not appearing:

1. Check that `public.blob.vercel-storage.com` is in your Next.js `images.domains` config
2. Verify your BLOB_READ_WRITE_TOKEN is set correctly
3. Check Vercel logs for any errors during the upload process 