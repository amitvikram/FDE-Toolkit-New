# Interest form email setup

The homepage interest form posts to `/api/interest` and emails each valid submission to `amitvik@gmail.com` through the Resend Email API.

## Form fields

- Name
- Work email
- Company
- Intended FDE-Toolkit use case
- Optional message

The submission endpoint includes server-side validation, a honeypot field, and basic per-IP rate limiting.

## Required Render configuration

1. Create or sign in to a Resend account using `amitvik@gmail.com`.
2. In Resend, create an API key with sending access.
3. In Render, open the `fde-toolkit` service.
4. Select **Environment**.
5. Add:

```text
RESEND_API_KEY=<your Resend API key>
```

6. Keep these values unless you want to change them:

```text
INTEREST_NOTIFICATION_EMAIL=amitvik@gmail.com
INTEREST_FROM_EMAIL=FDE-Toolkit <onboarding@resend.dev>
```

7. Save and deploy.

Never commit the API key to GitHub. The Render Blueprint declares `RESEND_API_KEY` with `sync: false`, so the secret must be supplied in the Render dashboard.

## Initial sender behavior

`onboarding@resend.dev` is useful for initial testing. Use the same email address for the Resend account and the notification recipient during this stage.

## Production sender

For a branded sender such as:

```text
FDE-Toolkit <leads@fde-toolkit.com>
```

add and verify `fde-toolkit.com` in Resend, publish the DNS records supplied by Resend, and then change `INTEREST_FROM_EMAIL` in Render.

The visitor's work email is set as the message reply-to address, so replying to the notification starts an email to that visitor.

## Testing

After deployment:

1. Open `https://fde-toolkit.com/#interest`.
2. Submit a test using an email address you can access.
3. Confirm the success message appears.
4. Confirm the notification arrives at `amitvik@gmail.com`.
5. Reply to the notification and verify the visitor's email is the recipient.

If the form reports that email delivery is not configured, confirm that `RESEND_API_KEY` exists in the Render service environment and redeploy.
