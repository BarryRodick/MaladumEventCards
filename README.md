# Maladum Event Cards

This project contains a small web application for managing event cards in the Maladum board game. It includes scripts and data for generating cards and a simple deck builder.

## Development

Install dependencies if needed and run the test suite with:

```bash
npm test
```

### Updating the Version

The application version is stored in `version.json`. After changing this file
run:

```bash
npm run build
```

This script syncs the version inside `service-worker.js` so you only need to
update it in one place.

## Image Notes

The campaign tracker pages let you attach photos from your device. Images are
stored as Base64 data inside your browser's `localStorage`. Most browsers limit
this storage to roughly 5&nbsp;MB, so keep images small and few in number. All
image data stays on your device and is never uploaded anywhere.

## License

This project is released under the [MIT License](LICENSE).

