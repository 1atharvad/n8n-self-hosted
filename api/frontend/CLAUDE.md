# Claude.md - Frontend Project Guide

## Project Overview

This is a modern frontend web application built with React + TypeScript + Vite.

### Tech Stack
- **Framework**: React 18 (with StrictMode)
- **Language**: TypeScript (strict mode)
- **Build Tool**: Vite (dev server + production builds)
- **Styling**: Tailwind CSS v3 + SCSS (utility-first with global tokens in `theme.scss`)
- **UI Library**: `advi-ui` (Atharva's component library)
- **Routing**: React Router v6 (basename: `/logs`)
- **Package Manager**: npm

## Project Structure

```
/src
  /components     # Reusable UI components
  /pages          # Page components / routes
    /Logs         # Main logs page (/)
    /Dashboard    # Dashboard page (/dashboard)
    /Settings     # Settings page (/settings)
    /Login        # Login page (/login)
  /hooks          # Custom React hooks
  /utils          # Utility functions
  /services       # API calls and external services
  /store          # State management
  /types          # TypeScript type definitions
  /assets         # Images, fonts, static files
  /styles         # Global styles and theme
    theme.scss    # Global Tailwind tokens and SCSS variables
```

## Routing Structure

**Base Path**: `/logs`

The application uses React Router v6 with the following routes:

- `/` → **Logs** (protected)
- `/dashboard` → **Dashboard** (protected)
- `/settings` → **Settings** (protected)
- `/login` → **Login** (public)

All routes except `/login` are wrapped in `ProtectedRoute` component for authentication.

## Code Standards

### Component Structure
- Use functional components with hooks
- Keep components small and focused (single responsibility)
- Extract logic into custom hooks when appropriate
- Use TypeScript for all components with proper prop types
- **Component hierarchy**:
  1. First, check `advi-ui` library for available components
  2. Then, check existing project components for reusable pieces
  3. Finally, create new granular components if needed
- **Granular, component-based architecture** - break UI into small, reusable pieces
- **One component per file** - no multiple components in the same file
- Extract complex logic into separate files/hooks

### Using `advi-ui` Library
- Import components from `advi-ui` package
- Follow library's component API and props conventions
- Extend `advi-ui` components with custom styling using Tailwind utilities
- Only build custom components when `advi-ui` doesn't provide needed functionality
- Check `advi-ui` documentation before implementing new UI elements

### Code Style (STRICT)
- **DO NOT use `React.FC`** - use explicit prop typing instead
- **Use `ReactNode`** imported from React (not `React.ReactNode`)
- **Always use semicolons** - every statement must end with `;`
- **Prefer `const` over `function`** - use arrow functions for components and functions
- **Import React** in every component file: `import React, { useState, ReactNode } from 'react';`

### Naming Conventions
- **Components**: PascalCase (e.g., `UserProfile.tsx`)
- **Hooks**: camelCase with `use` prefix (e.g., `useAuth.ts`)
- **Utils**: camelCase (e.g., `formatDate.ts`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `API_BASE_URL`)
- **Types/Interfaces**: PascalCase (e.g., `User`, `ApiResponse`)

### File Organization
- One component per file
- Group related components in feature folders
- Keep shared/common components in `/components`
- **Component folder structure**:
  ```
  /components
    /UserProfile
      UserProfile.tsx        # Main component
      UserHeader.tsx         # Sub-component
      UserAvatar.tsx         # Sub-component
      UserStats.tsx          # Sub-component
      index.ts               # Barrel export
  ```

### Code Style Enforcement

**Always follow these rules** - violations will be flagged in code review:

```typescript
// ❌ WRONG
import React from 'react';
export const MyComponent: React.FC = () => { ... }

// ✅ CORRECT
import React, { ReactNode } from 'react';
export const MyComponent = () => { ... }

// ❌ WRONG - missing semicolons
const name = "John"
const age = 25

// ✅ CORRECT - semicolons required
const name = "John";
const age = 25;

// ❌ WRONG - using function keyword
function handleClick() { ... }

// ✅ CORRECT - use const with arrow function
const handleClick = () => { ... };

// ❌ WRONG - React.ReactNode
interface Props {
  children: React.ReactNode;
}

// ✅ CORRECT - import ReactNode
import { ReactNode } from 'react';
interface Props {
  children: ReactNode;
}
```

## Development Guidelines

### When Writing Components
1. Start with TypeScript interfaces for props
2. Use semantic HTML elements
3. Ensure accessibility (ARIA labels, keyboard navigation)
4. Make components responsive by default
5. Handle loading and error states
6. Add proper error boundaries

### State Management
- Use local state for component-specific data
- Use context for theme, auth, user preferences
- Use global state (Redux/Zustand) for complex app-wide state
- Keep state as close to where it's used as possible

### Styling Guidelines
- Follow mobile-first approach
- **Primary**: Use Tailwind CSS v3 utility classes
- **Global tokens**: Defined in `theme.scss` (colors, spacing, typography)
- **SCSS**: Use for complex component-specific styles when utilities aren't enough
- Use consistent spacing and sizing scales from theme
- Avoid inline styles except for dynamic values
- Leverage CSS custom properties from theme.scss for theming

### Performance Considerations
- Lazy load routes and heavy components
- Memoize expensive calculations with `useMemo`
- Prevent unnecessary re-renders with `useCallback` and `memo`
- Optimize images (use next/image or similar)
- Code split large bundles

### API Integration
- Centralize API calls in `/services` directory
- Use async/await for API calls
- Implement proper error handling
- Add loading states for all async operations
- Use environment variables for API endpoints

## Common Patterns

### Protected Route Pattern
```typescript
import React, { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { LoadingSpinner } from '@/components/LoadingSpinner';

interface ProtectedRouteProps {
  children: ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};
```

### Router Setup
```typescript
import React from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Logs } from '@/pages/Logs';
import { Dashboard } from '@/pages/Dashboard';
import { Settings } from '@/pages/Settings';
import { Login } from '@/pages/Login';

const router = createBrowserRouter([
  {
    path: '/',
    element: <ProtectedRoute><Logs /></ProtectedRoute>,
  },
  {
    path: '/dashboard',
    element: <ProtectedRoute><Dashboard /></ProtectedRoute>,
  },
  {
    path: '/settings',
    element: <ProtectedRoute><Settings /></ProtectedRoute>,
  },
  {
    path: '/login',
    element: <Login />,
  },
], {
  basename: '/logs',
});

export const App = () => <RouterProvider router={router} />;
```

### Custom Hook Example
```typescript
import { useState, useEffect } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
}

export const useUser = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    fetchUser()
      .then(setUser)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  return { user, loading, error };
};
```

### Component Pattern (Custom)
```typescript
import React, { ReactNode } from 'react';

interface ButtonProps {
  variant?: 'primary' | 'secondary';
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}

export const Button = ({
  variant = 'primary',
  onClick,
  children,
  disabled = false,
}: ButtonProps) => {
  return (
    <button
      className={`btn btn-${variant}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
};
```

### Using advi-ui Components
```typescript
import React, { useState } from 'react';
import { Button, Card, Input } from 'advi-ui';

export const LoginForm = () => {
  const [email, setEmail] = useState('');

  const handleLogin = () => {
    // Login logic here
  };

  return (
    <Card className="p-6 max-w-md mx-auto">
      <Input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Enter your email"
        className="mb-4"
      />
      <Button variant="primary" onClick={handleLogin}>
        Log In
      </Button>
    </Card>
  );
};
```

### Granular Component Architecture Example
```typescript
// ❌ BAD - Everything in one file
export const UserProfile = () => {
  return (
    <div>
      <div className="header">...</div>
      <div className="avatar">...</div>
      <div className="stats">...</div>
      <div className="bio">...</div>
    </div>
  );
};

// ✅ GOOD - Split into smaller components
// components/UserProfile/UserProfile.tsx
import React from 'react';
import { UserHeader } from './UserHeader';
import { UserAvatar } from './UserAvatar';
import { UserStats } from './UserStats';
import { UserBio } from './UserBio';

export const UserProfile = () => {
  return (
    <div>
      <UserHeader />
      <UserAvatar />
      <UserStats />
      <UserBio />
    </div>
  );
};

// components/UserProfile/UserHeader.tsx
import React from 'react';

export const UserHeader = () => {
  return <div className="header">...</div>;
};

// ... and so on for other components
```

## Accessibility Checklist

- [ ] Semantic HTML elements
- [ ] Proper heading hierarchy (h1 → h2 → h3)
- [ ] Alt text for images
- [ ] ARIA labels for interactive elements
- [ ] Keyboard navigation support
- [ ] Focus indicators visible
- [ ] Color contrast meets WCAG standards
- [ ] Form labels associated with inputs

## TypeScript Configuration

This project uses **strict TypeScript** mode. Key settings:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

**Guidelines**:
- Always define explicit types for function parameters and returns
- Use interfaces for object shapes, types for unions/intersections
- Avoid `any` - use `unknown` if type is truly unknown
- Enable strict null checks - handle `null` and `undefined` explicitly

## Environment Variables

```env
# Vite environment variables (prefix with VITE_)
VITE_API_BASE_URL=
VITE_APP_NAME=
VITE_AUTH_ENABLED=true
# Add other environment variables here
```

**Note**: Vite only exposes variables prefixed with `VITE_` to the client.

## Common Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run linter
npm run lint

# Format code
npm run format
```

**Note**: Tests are maintained in the `advi-ui` library, not in this project.

## AI Assistant Instructions

When working on this project:

1. **NEVER use `React.FC`** - always use explicit prop typing with destructured parameters
2. **ALWAYS import `ReactNode` from React** - never use `React.ReactNode`
3. **ALWAYS use semicolons** - every statement must end with `;`
4. **ALWAYS use `const` with arrow functions** - never use `function` keyword
5. **ALWAYS import React** - `import React from 'react';` in every component file
6. **Use React 18 features** - take advantage of concurrent features and hooks
7. **Component hierarchy**:
   - First, check `advi-ui` library
   - Then, check existing project components
   - Finally, create new granular components
8. **Create granular, component-based architecture**:
   - Break UI into small, reusable pieces
   - One component per file
   - Extract complex sections into separate components
9. **Follow existing patterns** - check similar components before creating new ones
10. **Tailwind-first styling** - use utilities; only use SCSS for complex component styles
11. **Global tokens from theme.scss** - reference theme variables for consistency
12. **Respect routing structure** - basename is `/logs`; protected routes require `ProtectedRoute`
13. **Prioritize accessibility** - add ARIA labels, semantic HTML, keyboard support
14. **Handle edge cases** - loading states, errors, empty states, auth failures
15. **Write self-documenting code** - clear names over comments
16. **TypeScript strict mode** - no `any`, explicit types, handle nulls
17. **Ask clarifying questions** if requirements are unclear

### Before Writing Any Code

1. Check if `advi-ui` has the component
2. Check if project already has similar components to reuse
3. Plan component breakdown - identify all sub-components needed
4. Verify code style compliance - no `React.FC`, semicolons, arrow functions

## advi-ui Critical Rules

### CSS Specificity / Load Order

advi-ui styles load **after** Tailwind in the bundle: `index.scss → advi-ui/styles → theme.scss`.

This means advi-ui BEM classes (e.g. `vi-btn { justify-content: center }`) override same-specificity Tailwind utilities at runtime. **Never rely on Tailwind layout utilities to override advi-ui component internals.**

Rules:
- Use advi-ui's own props/variants for layout/style changes on its components.
- Use Tailwind only for spacing/sizing applied from the **outside** (margins, widths on the wrapper).

### PageAside Usage

```typescript
import { PageAside, AsideBtn } from 'advi-ui';

<PageAside
  open={asideOpen}
  onToggle={() => setAsideOpen((v) => !v)}
  openWidth="w-52"                // optional, default w-48
  items={[
    { icon: <Icon />, label: 'Label', onClick: () => navigate('/'), active: true },
  ]}
  footer={(open: boolean) => (
    <AsideBtn
      icon={<LogOut className="h-4 w-4" />}
      label="Sign out"
      onClick={handleLogout}
      tooltip={!open ? 'Sign out' : undefined}
    />
  )}
/>
```

- `footer` is a render prop `(open: boolean) => ReactNode` — use `AsideBtn` inside it for icon+label buttons to match nav item layout.
- **Do not** put a `Button` from advi-ui in the footer with `justify-start` — `vi-btn { justify-content: center }` will override it. Use `AsideBtn` instead.

### Header Component

`src/components/Header.tsx` is a shared header used by all pages.

```typescript
// Default (LogsPage) — shows pause/resume controls and log count
<Header />

// Other pages — shows breadcrumb title and custom right-side actions
<Header title="Dashboard" actions={<span>Last refreshed 12:00</span>} />
<Header title="Settings" actions={<Button onClick={...}>Back</Button>} />
```

Props:
- `title?: string` — appended as `/ title` in the breadcrumb; hides the log refresh timestamp
- `actions?: React.ReactNode` — replaces the default right-side slot entirely

### Page Shell Pattern

Every page follows this shell:

```typescript
const [asideOpen, setAsideOpen] = useState(false);

return (
  <div className="flex h-screen overflow-hidden">
    <PageAside open={asideOpen} onToggle={...} items={[...]} />
    <div className="flex flex-col flex-1 min-w-0">
      <Header title="Page Title" />
      <main className="flex-1 overflow-auto p-4">
        {/* page content */}
      </main>
    </div>
  </div>
);
```

## Zustand Stores

State lives in `src/store/`:

| Store | Purpose |
|-------|---------|
| `useLogStore` | Log entries, live streaming, pause/resume |
| `useAuthStore` | Auth state, user info, login/logout |
| `useSettingsStore` | App settings (theme, filters, preferences) |

Pattern: stores expose `load()` called inside `useEffect` in the consuming component.

---

**Last Updated**: 3rd May, 2026