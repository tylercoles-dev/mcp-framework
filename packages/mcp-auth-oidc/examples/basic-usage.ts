import { OIDCProvider, Providers } from '../src/index.js';

// Example 1: Using discovery URL
async function basicExample() {
  const provider = new OIDCProvider({
    clientId: 'your-client-id',
    clientSecret: 'your-client-secret',
    redirectUri: 'https://your-app.com/callback',
    discoveryUrl: 'https://your-provider.com/.well-known/openid-configuration'
  });

  await provider.initialize();

  // Generate authorization URL
  const authUrl = await provider.getAuthUrl('random-state');
  console.log('Authorization URL:', authUrl);

  // Handle callback (after user authorization)
  try {
    const tokens = await provider.handleCallback('authorization-code');
    console.log('Access Token:', tokens.accessToken);
    console.log('Refresh Token:', tokens.refreshToken);
    console.log('ID Token:', tokens.idToken);
  } catch (error) {
    console.error('Token exchange failed:', error);
  }

  // Verify token
  try {
    const user = await provider.verifyToken('access-token');
    if (user) {
      console.log('User:', user);
    } else {
      console.log('Token invalid');
    }
  } catch (error) {
    console.error('Token verification failed:', error);
  }
}

// Example 2: Using pre-configured Auth0 provider
async function auth0Example() {
  const auth0 = Providers.Auth0('your-domain.auth0.com', 'client-id', 'client-secret');
  
  await auth0.initialize();
  
  const authUrl = await auth0.getAuthUrl('state');
  console.log('Auth0 Authorization URL:', authUrl);
}

// Example 3: Using pre-configured Keycloak provider
async function keycloakExample() {
  const keycloak = Providers.Keycloak(
    'https://keycloak.example.com',
    'your-realm',
    'client-id',
    'client-secret'
  );
  
  await keycloak.initialize();
  
  const authUrl = await keycloak.getAuthUrl('state');
  console.log('Keycloak Authorization URL:', authUrl);
}

// Example 4: Custom claims mapping
async function customClaimsExample() {
  const provider = new OIDCProvider({
    clientId: 'client-id',
    discoveryUrl: 'https://provider.com/.well-known/openid-configuration',
    
    // Custom claim mappings
    idClaim: 'user_id',
    usernameClaim: 'login',
    emailClaim: 'mail',
    groupsClaim: 'roles',
    
    // Access control
    allowedGroups: ['admin', 'users'],
  });

  await provider.initialize();
  
  const user = await provider.verifyToken('access-token');
  console.log('User with custom claims:', user);
}

// Example 5: Using with PKCE
async function pkceExample() {
  const provider = new OIDCProvider({
    clientId: 'client-id',
    discoveryUrl: 'https://provider.com/.well-known/openid-configuration',
  });

  await provider.initialize();

  // Generate PKCE parameters
  const pkceParams = {
    codeChallenge: 'generated-code-challenge',
    codeChallengeMethod: 'S256' as const,
  };

  // Generate authorization URL with PKCE
  const authUrl = await provider.getAuthUrl('state', undefined, undefined, pkceParams);
  console.log('Authorization URL with PKCE:', authUrl);

  // Handle callback with code verifier
  const tokens = await provider.handleCallback(
    'authorization-code',
    'state',
    undefined,
    undefined,
    'code-verifier'
  );
  console.log('Tokens:', tokens);
}

// Run examples
if (require.main === module) {
  console.log('Running OIDC Provider examples...');
  
  // Note: These examples require actual OIDC provider configuration
  // Replace with your actual provider details to run
  
  // basicExample().catch(console.error);
  // auth0Example().catch(console.error);
  // keycloakExample().catch(console.error);
  // customClaimsExample().catch(console.error);
  // pkceExample().catch(console.error);
  
  console.log('Examples defined. Configure with your OIDC provider details to run.');
}