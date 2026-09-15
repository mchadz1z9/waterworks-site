# WaterWorks Admin — Setup (single-file version)

Only ONE of these 4 files goes into your GitHub repo: _worker.js
The other 3 are either dashboard setup or a paste into your existing site — not repo files.

## 1) _worker.js — goes in your repo
Put this file, named exactly "_worker.js", in the ROOT of your site repo
(same folder as index.html). Commit and push like normal. Your existing
site keeps working; this adds /admin and /api/* on top of it.

## 2) schema.sql — paste into Cloudflare dashboard (not GitHub)
Cloudflare dashboard -> Storage & Databases -> D1 -> Create database ->
name it waterworks_admin -> open it -> Console tab -> paste this file's
contents -> run it once.

## 3) Bind the database + set your password (Cloudflare dashboard, no file needed)
Your Pages project -> Settings -> Functions -> D1 database bindings ->
Add binding -> variable name "DB" -> pick waterworks_admin.
Same Settings page -> Environment variables -> add ADMIN_PASSWORD
(click Encrypt) -> set your password. Do both for Production and Preview.

## 4) embed-snippet.html — paste into your existing site's HTML (not GitHub as its own file)
Open it, copy the parts you want, paste into your existing pages wherever
you want live content / reviews / a review form to show up.

## Then
Visit waterworkslandscaping.ca/admin and log in with your password.
