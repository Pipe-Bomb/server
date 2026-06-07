# Pipe Bomb Server

The self hosted server for Pipe Bomb, which acts as a plugin host and aggregator of music metadata and libraries. Built on the NestJS framework.

The server itself doesn't actually provide any music or metadata capabilities - it leaves all data sources to be implemented by plugins. Plugins can provide three main components:

### Library Handler

Library Handlers

| Plugin Name                                                        | Purpose                                                                                                                                                                                       |
| :----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Local Library](https://github.com/pipe-bomb/local-library-plugin) | Scans all music in a given directory and reads basic attributes from audio file tags                                                                                                          |
| [Format](https://github.com/pipe-bomb/format-plugin)               | Uses FFprobe to detect audio information like codec, samplerate, channels, etc                                                                                                                |
| [Chromaprint](https://github.com/pipe-bomb/chromaprint-plugin)     | Generates AcoustID Chromaprints for each track                                                                                                                                                |
| [MusicBrainz](https://github.com/pipe-bomb/musicbrainz-plugin)     | Retrieves track, artist & album metadata from MusicBrainz. Requires [Chromaprint](https://github.com/pipe-bomb/chromaprint-plugin) for tracks that don't have MusicBrainz audio tags built in |
