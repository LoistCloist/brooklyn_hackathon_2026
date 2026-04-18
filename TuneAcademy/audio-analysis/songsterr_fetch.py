"""Songsterr GP file downloader — run standalone to test a song ID."""

import sys
import httpx
import pathlib
import json

SONGSTERR_META_URL = "https://www.songsterr.com/a/ra/song/{song_id}/default.json"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
    "Referer": "https://www.songsterr.com/",
}


def fetch_revision_meta(song_id: int, client: httpx.Client) -> dict:
    url = SONGSTERR_META_URL.format(song_id=song_id)
    resp = client.get(url, headers=HEADERS, follow_redirects=True)
    resp.raise_for_status()
    return resp.json()


def extract_source_url(meta: dict) -> str:
    """Pull the GP file URL out of the revision metadata."""
    # The meta JSON has a top-level 'source' field with the direct file URL.
    source = meta.get("source")
    if source:
        return source

    # Fallback: some revisions nest it under 'revisions[0].source'
    revisions = meta.get("revisions") or []
    if revisions:
        source = revisions[0].get("source")
        if source:
            return source

    raise ValueError(f"Could not find source URL in meta: {json.dumps(meta, indent=2)[:500]}")


def download_gp_file(source_url: str, dest_path: pathlib.Path, client: httpx.Client) -> None:
    resp = client.get(source_url, headers=HEADERS, follow_redirects=True)
    resp.raise_for_status()
    dest_path.write_bytes(resp.content)


def fetch_gp_for_song(song_id: int, output_dir: pathlib.Path = pathlib.Path("/tmp")) -> pathlib.Path:
    """
    Download the Guitar Pro file for a Songsterr song ID.
    Returns the local path to the downloaded file.
    """
    with httpx.Client(timeout=30) as client:
        print(f"[songsterr] Fetching metadata for song {song_id}...")
        meta = fetch_revision_meta(song_id, client)

        song_title = meta.get("title", f"song_{song_id}")
        artist = meta.get("artist", {}).get("name", "unknown")
        print(f"[songsterr] Found: '{song_title}' by {artist}")

        source_url = extract_source_url(meta)
        print(f"[songsterr] Source URL: {source_url}")

        # Detect extension from URL (.gp5, .gpx, .gp4, etc.)
        suffix = pathlib.Path(source_url.split("?")[0]).suffix or ".gp5"
        safe_title = "".join(c if c.isalnum() or c in "-_" else "_" for c in song_title)
        dest = output_dir / f"{song_id}_{safe_title}{suffix}"

        print(f"[songsterr] Downloading to {dest}...")
        download_gp_file(source_url, dest, client)
        print(f"[songsterr] Done — {dest.stat().st_size} bytes")
        return dest


if __name__ == "__main__":
    song_id = int(sys.argv[1]) if len(sys.argv) > 1 else 13287  # default: Enter Sandman
    path = fetch_gp_for_song(song_id)
    print(f"\nSaved: {path}")
