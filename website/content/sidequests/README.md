# Sidequests

Each JSON file in this folder automatically generates a page at `/sidequest/[filename]` and appears in the sidequests list on the home page.

## Creating a new sidequest

1. Create a new JSON file: `your-app.json`
2. Add images to `public/sidequests/your-app/`
3. Done - page is live at `/sidequest/your-app`

## JSON Schema

```json
{
  "title": "App Name",
  "tagline": "One line description",
  "category": "Fintech",
  "date": "2024-12",
  "status": "live",
  "platform": "ios",
  "logo": "/sidequests/your-app/logo.png",
  "screenshots": [
    "/sidequests/your-app/screenshot-1.png"
  ],
  "announcement": "Optional banner text",
  "pills": [
    { "icon": "users", "text": "Feature tag" }
  ],
  "features": [
    {
      "icon": "camera",
      "title": "Feature Title",
      "description": "Feature description text"
    }
  ],
  "actions": {
    "primary": {
      "icon": "phone",
      "label": "For iOS",
      "href": "https://..."
    },
    "secondary": {
      "icon": "apple",
      "label": "Download",
      "href": "https://..."
    }
  }
}
```

## Required Fields

| Field | Description |
|-------|-------------|
| `title` | App name |
| `tagline` | Short description |
| `category` | Category shown in list (e.g. "Fintech", "Productivity") |
| `date` | Release date in YYYY-MM format (e.g. "2024-12") - displayed as "Dec 2024" |
| `status` | `"live"`, `"coming-soon"`, or `"archived"` |
| `platform` | `"ios"` or `"macos"` - affects screenshot display |
| `logo` | Path to logo image |
| `screenshots` | Array of screenshot paths |
| `pills` | Array of feature tags |
| `features` | Array of feature cards |
| `actions` | CTA buttons |

## Optional Fields

| Field | Description |
|-------|-------------|
| `announcement` | Banner text shown above screenshots |

## Available Icons

| Icon | Use for |
|------|---------|
| `users` | Social, groups, sharing |
| `camera` | Photos, scanning |
| `currency` | Money, payments |
| `pdf` | Documents, export |
| `envelope` | Email, messages |
| `plane` | Travel, sending |
| `chat` | Messaging, communication |
| `smile` | Fun, social |
| `desktop` | macOS app |
| `mail` | Contact, email |
| `phone` | iOS app |
| `apple` | App Store download |

## Platform Differences

- `"platform": "ios"` - Shows phone mockups in a carousel
- `"platform": "macos"` - Shows full-width desktop screenshot
