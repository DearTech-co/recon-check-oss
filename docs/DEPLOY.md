# Putting Recon Check on Netlify

The live site is [recon-check-deartech.netlify.app](https://recon-check-deartech.netlify.app).

`netlify.toml` tells Netlify how to build the site. Netlify installs the packages, runs `npm run build`, and publishes the `dist` folder. The build uses Node 20. The same build is used for the live site, for pull request previews, and for other branches.

Nothing in this repository deploys the site by itself. Someone with access to Netlify and GitHub still has to connect the existing site to this repository and turn branch previews on. Do not create a second Netlify site. Do not add GitHub secrets. This setup does not use `NETLIFY_AUTH_TOKEN` or `NETLIFY_SITE_ID`.

## Settings to change

In Netlify, open the existing site **recon-check-deartech**.

1. Link it to the GitHub repository `DearTech-co/recon-check`. When GitHub asks, give the Netlify app access to that repository.
2. Set the production branch to `main`.
3. Open **Project configuration → Build & deploy → Continuous deployment → Branches and deploy contexts → Configure**.
4. Set **Branch deploys** to **All**. Branch deploys are off until this is changed. This is what publishes a preview for every push to a branch other than `main`.
5. Leave **Deploy Previews** on, so every pull request gets a preview. The pull request’s base branch should be `main`.
6. Leave the base directory empty. The build command is `npm run build` and the publish directory is `dist`. Those values are already in `netlify.toml`, and that file overrides the same boxes on the Netlify screen.

No environment variables or secrets are required.

## What happens after that

- Merging into `main` updates the live site, https://recon-check-deartech.netlify.app. A direct push to `main` does the same, because Netlify treats `main` as the production branch.
- A pull request gets an address like `https://deploy-preview-123--recon-check-deartech.netlify.app`.
- A push to any other branch gets an address like `https://that-branch--recon-check-deartech.netlify.app`.
