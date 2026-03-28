# Cognito WebAuthn (passkeys) — operational prerequisites

This API expects **Amazon Cognito** to own passkeys (USER_AUTH / WEB_AUTHN). MongoDB-stored passkeys from the legacy stack are **not** migrated; users must **register passkeys again** in Cognito after cutover.

## User pool

- Enable **choice-based sign-in** and **passkeys** per [AWS Cognito authentication](https://docs.aws.amazon.com/cognito/latest/developerguide/authentication.html).
- Set the **WebAuthn relying party ID** in the **user pool** (not in `nest-app` env). After the Cognito passkey migration, **`WEBAUTHN_RP_*` in `.env` is ignored**—only the pool setting matters.

### Relying party ID must match the page origin

WebAuthn validates that `rp.id` is appropriate for the URL in the address bar:

| You open the app at | Valid `rp.id` examples |
|---------------------|-------------------------|
| `http://localhost:5173` | `localhost` |
| `https://app.example.com` | `app.example.com` or `example.com` (per WebAuthn rules) |

If Cognito’s **Relying party ID** is set to your **Cognito hosted domain** (e.g. `us-east-1xxxx.auth.us-east-1.amazoncognito.com`) but users sign in from **`localhost`**, the browser reports:

`The RP ID "…amazoncognito.com" is invalid for this domain`

**Fix:** In the Cognito console, open the user pool → sign-in / passkeys (WebAuthn) settings → set **Relying party ID** to `localhost` for local development, and to your real app hostname (e.g. `app.example.com`) for production. You may need separate pools or careful RP configuration if you use multiple origins.

## App client

- Enable **`ALLOW_USER_AUTH`** so `USER_AUTH` and `WEB_AUTHN` challenges work from this app.
- Keep other flows (e.g. SRP/password) as needed.

## Access token (registration & management)

The app client must issue access tokens that include the **`aws.cognito.signin.user.admin`** scope. That scope is required for:

- `StartWebAuthnRegistration` / `CompleteWebAuthnRegistration`
- `ListWebAuthnCredentials`
- `DeleteWebAuthnCredential`

Configure this on the app client’s **OAuth 2.0 scopes** / resource server settings in Cognito.

## Client secret

If the app client has a **client secret**, all `InitiateAuth` / `RespondToAuthChallenge` calls must include `SECRET_HASH`. This codebase does not currently add `SECRET_HASH`; use a public client or extend `CognitoService` if you use a confidential client.
