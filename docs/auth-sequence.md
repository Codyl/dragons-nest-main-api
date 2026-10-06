# Auth Sequence Diagrams

## Primary Login (Amplify SRP)

```mermaid
sequenceDiagram
    participant User
    participant Portal as Portal (Browser)
    participant Amplify as Amplify SDK
    participant API as NestJS Backend
    participant Cognito as AWS Cognito

    User->>Portal: Enter email + password
    Portal->>Amplify: signIn(email, password)
    Amplify->>Cognito: SRP auth (password never leaves browser)
    Cognito-->>Amplify: AccessToken, IdToken, RefreshToken
    Amplify-->>Portal: Tokens stored in Amplify storage

    Portal->>API: POST /auth/set-session {AccessToken, IdToken}
    API->>Cognito: Verify tokens (JWKS signature, expiry, audience)
    Cognito-->>API: Valid
    API-->>Portal: Set-Cookie: ACCESS_TOKEN, ID_TOKEN, REFRESH_TOKEN (HttpOnly)

    Note over Portal,API: Subsequent requests use cookies automatically
```

## Authenticated API Request

```mermaid
sequenceDiagram
    participant Portal as Portal (Browser)
    participant API as NestJS Backend
    participant Cognito as AWS Cognito (JWKS)

    Portal->>API: Any request (cookies sent via credentials: include)
    API->>API: AuthGuard reads ACCESS_TOKEN cookie
    API->>Cognito: Verify JWT (aws-jwt-verify, cached JWKS)
    Cognito-->>API: Signature valid, not expired
    API->>API: Attach decoded payload to request.user
    API-->>Portal: 200 response
```

## Token Refresh (401 intercepted)

```mermaid
sequenceDiagram
    participant Portal as Portal (Browser)
    participant Amplify as Amplify SDK
    participant API as NestJS Backend
    participant Cognito as AWS Cognito

    Portal->>API: Request (expired ACCESS_TOKEN cookie)
    API-->>Portal: 401 Unauthorized

    Note over Portal: ky beforeRetry hook fires

    rect rgb(240, 248, 255)
        Note over Portal,Cognito: Strategy 1: Amplify-managed refresh
        Portal->>Amplify: refreshCognitoSession()
        Amplify->>Cognito: Refresh token exchange
        Cognito-->>Amplify: New AccessToken, IdToken
        Amplify-->>Portal: Fresh tokens
        Portal->>API: POST /auth/set-session {AccessToken, IdToken}
        API->>Cognito: Verify new tokens
        Cognito-->>API: Valid
        API-->>Portal: Set-Cookie (new HttpOnly cookies)
    end

    alt Amplify refresh fails
        rect rgb(255, 248, 240)
            Note over Portal,Cognito: Strategy 2: Cookie-based fallback
            Portal->>API: POST /auth/refresh-token (REFRESH_TOKEN cookie sent)
            API->>Cognito: InitiateAuth (REFRESH_TOKEN_AUTH)
            Cognito-->>API: New AccessToken, IdToken
            API-->>Portal: Set-Cookie (new HttpOnly cookies)
        end
    end

    Portal->>API: Retry original request (fresh cookies)
    API-->>Portal: 200 response
```

## Signup + Auto-Login

```mermaid
sequenceDiagram
    participant User
    participant Portal as Portal (Browser)
    participant API as NestJS Backend
    participant Cognito as AWS Cognito
    participant DB as Database

    User->>Portal: Fill signup form
    Portal->>API: POST /auth/initiate-signup {email, password}
    API->>Cognito: SignUp(email, password)
    Cognito-->>API: CodeDeliveryDetails, Session
    API-->>Portal: {Session}

    Cognito->>User: Verification code (email)

    User->>Portal: Enter verification code
    Portal->>API: POST /auth/confirm-signup {username, code, session, password}
    API->>Cognito: ConfirmSignUp(username, code, session)
    Cognito-->>API: Confirmed
    API->>Cognito: AdminGetUser(username)
    Cognito-->>API: User attributes (sub)
    API->>DB: Create user record (cognitoSub, accountType, etc.)
    API->>Cognito: AuthenticateWithSRP(email, password)
    Cognito-->>API: AccessToken, IdToken, RefreshToken
    API-->>Portal: Set-Cookie (HttpOnly) + 200
```

## Google Sign-In (existing account)

```mermaid
sequenceDiagram
    participant User
    participant Portal as Portal (Browser)
    participant Google as Google Identity Services
    participant API as NestJS Backend
    participant Cognito as AWS Cognito
    participant DB as Database

    User->>Portal: Click "Sign in with Google"
    Portal->>Google: GSI popup / One Tap
    Google-->>Portal: Google ID token (credential JWT)

    Portal->>API: POST /auth/google-token-exchange {credential}
    API->>Google: verifyIdToken(credential, audience)
    Google-->>API: Payload {email, sub}

    API->>Cognito: ListUsers(filter: email)
    Cognito-->>API: Existing user found

    API->>DB: Verify user has GOOGLE in linkedProviders
    DB-->>API: Confirmed

    API->>Cognito: AdminInitiateAuth(CUSTOM_AUTH, username)
    Cognito-->>API: CUSTOM_CHALLENGE + Session

    API->>Cognito: AdminRespondToAuthChallenge(ANSWER: credential)
    Cognito-->>API: AuthenticationResult (AccessToken, IdToken, RefreshToken)

    API-->>Portal: Set-Cookie (HttpOnly) + 200
    Portal->>Portal: markAuthenticated() + navigate to /
```

## Google Sign-Up (new account)

```mermaid
sequenceDiagram
    participant User
    participant Portal as Portal (Browser)
    participant Google as Google Identity Services
    participant API as NestJS Backend
    participant Cognito as AWS Cognito
    participant DB as Database

    User->>Portal: Click "Sign in with Google"
    Portal->>Google: GSI popup / One Tap
    Google-->>Portal: Google ID token (credential JWT)

    Portal->>API: POST /auth/google-token-exchange {credential}
    API->>Google: verifyIdToken(credential, audience)
    Google-->>API: Payload {email, sub}
    API->>Cognito: ListUsers(filter: email)
    Cognito-->>API: No user found
    API-->>Portal: 409 Conflict (account doesn't exist)

    Note over Portal: Frontend auto-retries with signup endpoint

    Portal->>API: POST /auth/google-sso-signup {credential}
    API->>Google: verifyIdToken(credential, audience)
    Google-->>API: Payload {email, sub, name}

    API->>Cognito: AdminCreateUser(email, tempPassword, SUPPRESS)
    Cognito-->>API: User created (cognitoSub)

    API->>Cognito: AdminLinkProviderForUser(Google sub → Cognito sub)
    Cognito-->>API: Linked

    API->>DB: Upsert user (cognitoSub, linkedProviders: [GOOGLE], hasPassword: false)

    API->>Cognito: AdminInitiateAuth(ADMIN_USER_PASSWORD_AUTH, tempPassword)
    Cognito-->>API: AuthenticationResult (AccessToken, IdToken, RefreshToken)

    API-->>Portal: Set-Cookie (HttpOnly) + 200
    Portal->>Portal: markAuthenticated() + navigate to /
```

## Logout

```mermaid
sequenceDiagram
    participant Portal as Portal (Browser)
    participant API as NestJS Backend
    participant Cognito as AWS Cognito

    Portal->>API: POST /auth/logout (ACCESS_TOKEN cookie)
    API->>Cognito: GlobalSignOut(accessToken)
    Cognito-->>API: Tokens revoked
    API-->>Portal: Clear-Cookie: ACCESS_TOKEN, ID_TOKEN, REFRESH_TOKEN
    Portal->>Portal: clearAuthenticated() + redirect to /verify-username
```
