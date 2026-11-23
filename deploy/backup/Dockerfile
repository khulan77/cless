# pg_dump/pg_restore (Postgres 16) + rclone (S3-compatible руу хуулах, сонголттой)
FROM postgres:16
RUN apt-get update \
  && apt-get install -y --no-install-recommends rclone ca-certificates tzdata \
  && rm -rf /var/lib/apt/lists/*
COPY run.sh /usr/local/bin/backup-loop
RUN chmod +x /usr/local/bin/backup-loop
ENV TZ=Asia/Ulaanbaatar
ENTRYPOINT []
CMD ["backup-loop"]
