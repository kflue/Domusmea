# Domusmea

lat. for my home. A home management software for home owners. This project uses AI.

## First sign-in

Open Domusmea on the machine it runs on and sign in with `admin` / `admin`. You are then asked to
choose your own username and password; afterwards only those work. To do the first sign-in from
another device, start the server with `ALLOW_REMOTE_SETUP=true`.

Change your password, see recent sign-ins or sign out on all devices under **Settings → Sign-in and
security**.

Forgot your password? Stop the server and run `npm run reset-login` in `Domusmea/` (after
`npm run build`). This resets the sign-in to `admin` / `admin` and keeps all your data.
