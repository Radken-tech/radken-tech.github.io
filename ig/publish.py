"""Radken Tech Instagram publisher.

Runs once a day from GitHub Actions. It reads ig/queue.json, finds posts whose
date has arrived and that are not yet posted, and publishes them to Instagram
through the official Instagram Graph API (business accounts).

Safe mode: if the IG_USER_ID / IG_ACCESS_TOKEN secrets are missing, or the
DRY_RUN variable is "1", it only prints what it would post and changes nothing.

Each post in the queue looks like:
  {"id": "p001", "date": "2026-11-10", "image": "ig/img/p001.jpg",
   "caption": "...", "posted": false}
Instagram needs a public JPEG URL; images live on the website, so
ig/img/p001.jpg is served at https://radken-tech.github.io/ig/img/p001.jpg
"""
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

SITE = "https://radken-tech.github.io"
GRAPH = "https://graph.facebook.com/v21.0"
QUEUE = os.path.join(os.path.dirname(__file__), "queue.json")
EAT = timezone(timedelta(hours=3))  # Dar es Salaam time
MAX_PER_RUN = 1  # one post a day keeps the account looking natural


def graph(method, path, **params):
    """Call the Graph API and return the JSON reply (raises on an error reply)."""
    data = urllib.parse.urlencode(params).encode()
    url = f"{GRAPH}/{path}"
    if method == "GET":
        req = urllib.request.Request(url + "?" + data.decode())
    else:
        req = urllib.request.Request(url, data=data, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        # Never print the token: the error body from Meta does not contain it.
        raise RuntimeError(f"Instagram API error {e.code}: {body}") from None


def image_reachable(url):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, method="HEAD"), timeout=30) as r:
            return r.status == 200
    except Exception:
        return False


def publish(user_id, token, image_url, caption):
    """Two-step publish: create a media container, wait until ready, publish it."""
    c = graph("POST", f"{user_id}/media", image_url=image_url, caption=caption, access_token=token)
    cid = c["id"]
    for _ in range(12):  # up to ~1 minute for Instagram to fetch the image
        s = graph("GET", cid, fields="status_code", access_token=token)
        if s.get("status_code") == "FINISHED":
            break
        if s.get("status_code") == "ERROR":
            raise RuntimeError("Instagram could not process the image (check it is a JPEG under 8 MB).")
        time.sleep(5)
    p = graph("POST", f"{user_id}/media_publish", creation_id=cid, access_token=token)
    return p["id"]


def main():
    user_id = os.environ.get("IG_USER_ID", "").strip()
    token = os.environ.get("IG_ACCESS_TOKEN", "").strip()
    dry = os.environ.get("DRY_RUN") == "1" or not (user_id and token)
    today = datetime.now(EAT).date().isoformat()

    with open(QUEUE, encoding="utf-8") as f:
        queue = json.load(f)
    due = [p for p in queue["posts"] if not p.get("posted") and p.get("date", "9999") <= today]
    print(f"Today (Dar time): {today}. Posts in queue: {len(queue['posts'])}. Due now: {len(due)}.")
    if dry:
        print("SAFE MODE: Instagram key not set (or DRY_RUN=1). Nothing will be posted.")

    changed = False
    failures = 0
    for post in due[:MAX_PER_RUN]:
        url = f"{SITE}/{post['image'].lstrip('/')}"
        print(f"- {post['id']} ({post['date']}): {url}")
        if not image_reachable(url):
            print("  Image is not live on the website yet; will try again next run.")
            continue
        if dry:
            print("  Would post with caption:\n  " + post["caption"].replace("\n", "\n  "))
            continue
        try:
            media_id = publish(user_id, token, url, post["caption"])
            post["posted"] = True
            post["postedAt"] = datetime.now(EAT).isoformat(timespec="minutes")
            post["mediaId"] = media_id
            changed = True
            print(f"  Posted. Instagram media id {media_id}.")
        except Exception as e:
            failures += 1
            post["lastError"] = str(e)[:300]
            changed = True
            print(f"  FAILED: {e}")

    if changed:
        with open(QUEUE, "w", encoding="utf-8") as f:
            json.dump(queue, f, ensure_ascii=False, indent=2)
            f.write("\n")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
