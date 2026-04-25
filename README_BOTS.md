# FactPulse Bots

## Added files

- `clip_ai_bot.py`, local Python clip search helper.
- `youtube_upload_bot.py`, standalone YouTube uploader.
- `requirements.txt`, Python packages.
- `.gitignore`, keeps private local files out of the repo.
- `run_local_bot.sh`, starts the local clip bot.

## Run the clip bot

```bash
chmod +x run_local_bot.sh
./run_local_bot.sh
```

Open:

```text
http://127.0.0.1:8000/health
```

## Test YouTube uploader without posting

```bash
python3 youtube_upload_bot.py --video rendered_uploads/example.webm --title "Example Short" --description "Test upload" --dry-run
```

## Real upload

```bash
python3 youtube_upload_bot.py --video rendered_uploads/example.webm --title "Example Short" --description "Test upload" --privacy private
```

Start with private uploads first.

## Better clip accuracy

- Put the exact subject in Subject.
- Use Auto fill fact and scene.
- Use clear scene words.
- Add free stock keys for more results.

Examples:

```text
Subject: Nikola Tesla
Scene: inventor laboratory electricity machine experiment
```

```text
Subject: person in court
Scene: courtroom judge lawyer courthouse legal documents
```

```text
Subject: volcano eruption
Scene: volcano lava eruption smoke mountain
```
