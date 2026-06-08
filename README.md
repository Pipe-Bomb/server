<h1>
    <img src="https://raw.githubusercontent.com/Pipe-Bomb/.github/refs/heads/master/assets/logos/Pipe%20Bomb%20no%20background%20w%20outline.png" width="40" />
    Pipe Bomb Server
</h1>

The self hosted server for Pipe Bomb, which acts as a plugin host and aggregator of music metadata and libraries. Built on the NestJS framework.

## Getting Started

Pipe Bomb server requires Node.js 24 and FFmpeg. Clone the repository, then run:

```bash
npm ci
npm run build
npm run start:prod
```

The server will start on port 3000.

The "access-control-allow-origin" header can be configured using the environment variable `CORS`.

Pipe Bomb server supports sending "httpOnly" cookies to the client for use with the official [Pipe Bomb frontend](https://github.com/Pipe-Bomb/website). In this case, the cookie domain can be configured using the environment variable `COOKIE_DOMAIN`. To have the cookie be shared across subdomains, including a leading ".".

Example ".env" file:

```bash
CORS="https://pipebomb.net"
COOKIE_DOMAIN=".pipebomb.net"
```

## Data Storage

Pipe Bomb server stores data in a few places and expects most of it to be persistent:

| Directory      | Persistent | Use                                                                                                                                                                                                                                                                                                                                           |
| :------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `audio-cache`  | 🔶         | Stores audio from cacheable audio producers to speed up audio playback. Clearing this directory is usually fine, but means audio needs to be retrived from the source location again, which may be slow depending on the plugin. **Generally recommended to keep persisted.**                                                                 |
| `plugin-cache` | 🔶         | Stores data that plugins request to have cached. Depending on the plugin, persisting this directory may be necessary. Some plugins use this directory to cache data such as API responses. In these cases, clearing the directory would cause responses to be slower until data is cached again. **Generally recommended to keep persisted.** |
| `plugins`      | ✅         | Stores plugin code. Clearing this directory deletes all installed plugins.                                                                                                                                                                                                                                                                    |
| `resources`    | ✅         | Stores buffer attribute data, such as cover art. Clearing this directory would result in all buffer attributes losing their values until re-downloaded the next time all attributes are generated.                                                                                                                                            |
| `temp`         | ❌         | Provides a temporary directory for plugins to dump data in for a short period of time. Directory is cleared automatically on server start and doesn't need to be persisted. The directory may grow to a large size during use depending on how plugins use it.                                                                                |
| `dev.sqlite`   | ✅         | Stores all information such as users, tracks, artists, albums, identities, attributes, playlists, etc. Deleting this file would cause the server to effectively be completely reset.                                                                                                                                                          |

## Server Architecture

The server itself doesn't actually provide any music or metadata capabilities - it leaves all data sources to be implemented by plugins. Plugins can provide these main components:

### [Library Handler](https://github.com/Pipe-Bomb/server/blob/master/sdk/library-handler.d.ts)

Library Handlers are responsible for providing a list of tracks and their audio.

### [Track Identifier, Artist Identifier & Album Identifier](https://github.com/Pipe-Bomb/server/blob/master/sdk/identifier.d.ts)

Identifiers are responsible for assigning "Identities" to track, artist or album entities. Identities are pieces of identifiable information, like a Chromaprint audio fingerprint or a Spotify Artist ID. These identities define the relationships between tracks, artists and albums.

### [Attribute Source](https://github.com/Pipe-Bomb/server/blob/master/sdk/attribute-source.d.ts)

Attribute Sources take information like Identities or an audio stream, and return attributes for a given track, artist or album. Attributes are defined by the Attribute Source and can be anything, from artist name, to album cover art, to track sample rate.

### [Ephemeral Source](https://github.com/Pipe-Bomb/server/blob/master/sdk/ephemeral-source.d.ts)

Ephemeral sources connect to a Library Handler and provide searchability to collections of tracks, artists and albums that aren't solely indexed by the Library Handler. While a Library Handler may be adequate for a local music library where all tracks can be indexed at once, Ephemeral Sources allow for integration with databases of tracks, artists and albums where scanning the entire library at once isn't feasible.

### [External URL Source](https://github.com/Pipe-Bomb/server/blob/master/sdk/external-url-source.d.ts)

External Url Sources take an Identity for a track, artist or album and return a URL. These can be used to link to public pages such as Spotify Artist pages, or internal tools.

---

**Plugins can implement as many or as few of these components as necessary. Example use cases:**

| Plugin Name                                                        | Implementation                                                                                                                                                                                                                                                                                                                                                                             |
| :----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Format](https://github.com/pipe-bomb/format-plugin)               | only implements an Attribute Source and reads the audio stream to return attributes like codec and bit rate.                                                                                                                                                                                                                                                                               |
| [Local Library](https://github.com/pipe-bomb/local-library-plugin) | implements a Library Handler to index all tracks located in a given directory, and an Attribute Source that reads audio tags from the audio stream.                                                                                                                                                                                                                                        |
| [MusicBrainz](https://github.com/pipe-bomb/musicbrainz-plugin)     | implements Identifiers that read MusicBrainz IDs from audio tags located in the audio stream, or identifies MusicBrainz IDs from AcoustID using an Identity provided by the [Chromaprint](https://github.com/pipe-bomb/chromaprint-plugin) plugin. It also implements an Attribute Source that retrieves attributes from the MusicBrainz API using the Identities that it already located. |

---

**To learn more about what you can do with plugins and how to implement them, check out the source code for these officially maintained plugins:**
| Plugin Name | Purpose |
| :----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Local Library](https://github.com/pipe-bomb/local-library-plugin) | Scans all music in a given directory and reads basic attributes from audio file tags |
| [Format](https://github.com/pipe-bomb/format-plugin) | Uses FFprobe to detect audio information like codec, samplerate, channels, etc |
| [Chromaprint](https://github.com/pipe-bomb/chromaprint-plugin) | Generates AcoustID Chromaprints for each track |
| [MusicBrainz](https://github.com/pipe-bomb/musicbrainz-plugin) | Retrieves track, artist & album metadata from MusicBrainz. Requires [Chromaprint](https://github.com/pipe-bomb/chromaprint-plugin) for tracks that don't have MusicBrainz audio tags built in |

## Developing a Plugin

The plugins listed above are a great place to start understanding how Pipe Bomb's internals work. To make a new plugin, create a directory inside your server's `plugins` directory.

All necessary types are located in `/sdk`. If using TypeScript, you can add the following snippet to your `tsconfig.json`:

```json
{
	"compilerOptions": {
		"paths": {
			"@sdk": ["../../sdk/index.d.ts"]
		}
	}
}
```

Pipe Bomb server expects plugins to be plain JavaScript, so ensure you transpile any TypeScript code.

Your plugin's entrypoint is defined in `package.json`. Pipe Bomb server first looks for "`pipebombEntry`". If that doesn't exist, it'll use "`main`" and finally fall back to "`index.js`".

If you start Pipe Bomb server with `npm run start:plugin-dev`, the server will automatically restart when it detects changes in the plugin directory.

## Roadmap

- ✅ Ephemeral Sources

- ✅ External URL Sources

- ✅ Playlists

- 🚧 Update playlist attributes

- ➖ Save ephemeral artists and albums without manually copying to a playlist

- ➖ Search Handler for plugins to replace search provided by server

- ➖ User overridable attributes and identities

- ➖ Group playlists

- ➖ Customizable playlist visibility

- ➖ User attributes

- ➖ Playback sessions

- ➖ Chromecast

- ➖ Ephemeral playlists generated by plugins per-user

- ➖ Automatically add tracks to playlist based on attributes matching criteria

## Credits & Contributing

Pipe Bomb is conceptualised and developed by [eyezah](https://github.com/eyezahhhh), but contributions are welcome!
