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

## License

This project is released under the [MIT License](LICENSE).

