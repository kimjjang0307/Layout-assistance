# Deployment Guide

This guide provides instructions for deploying the **AI Animation Layout Assistant** to two popular platforms: Google Cloud Run and Vercel.

## Prerequisites

Before you begin, ensure you have the following:

- **Node.js and npm:** Installed on your local machine.
- **Git:** Installed and configured.
- **Google Cloud Account:** An active account with billing enabled and the `gcloud` CLI installed.
- **Vercel Account:** An account linked to your GitHub, GitLab, or Bitbucket account.
- **Gemini API Key:** A valid API key for the Gemini API. You can get one from [Google AI Studio](https://aistudio.google.com/app/apikey).

---

## 1. Deploying to Google Cloud Run

This method involves containerizing the application using Docker and deploying it as a serverless container.

### Step 1: Create Containerization Files

We need two files to containerize the app: `Dockerfile` and `nginx.conf`. If these files are not already in your project root, create them with the following content:

**`Dockerfile`:** This file defines the steps to build and run your application in a Docker container.

```dockerfile
# Stage 1: Build the React application
FROM node:20-alpine AS build

WORKDIR /app

# Copy package.json and install dependencies
COPY package.json ./
RUN npm ci

# Copy the rest of the application source code
COPY . .

# Make the API key available to the build process as an argument
ARG GEMINI_API_KEY
ENV GEMINI_API_KEY=$GEMINI_API_KEY

# Build the application for production
RUN npm run build

# Stage 2: Serve the static files with Nginx
FROM nginx:1.25-alpine

# Copy the build output from the build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy the custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
```

**`nginx.conf`:** This is a configuration file for the Nginx web server to correctly serve our Single-Page Application (SPA).

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri /index.html;
    }
}
```

### Step 2: Build and Push the Docker Image

1.  **Authenticate with Google Cloud:**
    ```bash
    gcloud auth login
    gcloud config set project YOUR_PROJECT_ID
    ```

2.  **Enable Required APIs:**
    ```bash
    gcloud services enable run.googleapis.com
    gcloud services enable artifactregistry.googleapis.com
    ```

3.  **Create an Artifact Registry Repository:**
    ```bash
    gcloud artifacts repositories create my-app-repo \
        --repository-format=docker \
        --location=us-central1 \
        --description="Docker repository for my app"
    ```
    *(Replace `us-central1` with your preferred region.)*

4.  **Configure Docker Authentication:**
    ```bash
    gcloud auth configure-docker us-central1-docker.pkg.dev
    ```

5.  **Build the Docker Image:**
    This command builds your container image and passes your local Gemini API key as a build-time argument.
    ```bash
    docker build --build-arg GEMINI_API_KEY="YOUR_GEMINI_API_KEY" -t us-central1-docker.pkg.dev/YOUR_PROJECT_ID/my-app-repo/layout-assistant:latest .
    ```
    - Replace `YOUR_GEMINI_API_KEY` with your actual key.
    - Replace `YOUR_PROJECT_ID` with your Google Cloud Project ID.

6.  **Push the Image to Artifact Registry:**
    ```bash
    docker push us-central1-docker.pkg.dev/YOUR_PROJECT_ID/my-app-repo/layout-assistant:latest
    ```

### Step 3: Deploy to Cloud Run

Deploy the container you just pushed. This command also configures the service to allow unauthenticated access so anyone can visit the URL.

```bash
gcloud run deploy layout-assistant-service \
    --image=us-central1-docker.pkg.dev/YOUR_PROJECT_ID/my-app-repo/layout-assistant:latest \
    --platform=managed \
    --region=us-central1 \
    --allow-unauthenticated
```

After a few moments, the command will output a **Service URL**. You can visit this URL to see your deployed application.

---

## 2. Deploying to Vercel (via GitHub)

This is a straightforward method that leverages Vercel's seamless integration with Git providers.

### Step 1: Push Your Code to GitHub

1.  If you haven't already, create a new repository on GitHub.
2.  Initialize a Git repository in your project folder and push your code:
    ```bash
    git init
    git add .
    git commit -m "Initial commit"
    git branch -M main
    git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
    git push -u origin main
    ```

### Step 2: Import Project to Vercel

1.  Log in to your [Vercel dashboard](https://vercel.com/dashboard).
2.  Click **Add New...** and select **Project**.
3.  Find your GitHub repository and click **Import**.
4.  Vercel will automatically detect that it's a Vite project. The default build settings should be correct:
    - **Build Command:** `vite build` or `npm run build`
    - **Output Directory:** `dist`

### Step 3: Configure Environment Variable

This is the most critical step. You must provide your Gemini API key so the application can access the Gemini API.

1.  In the Vercel project configuration screen, expand the **Environment Variables** section.
2.  Add a new variable:
    - **Name:** `GEMINI_API_KEY`
    - **Value:** Paste your actual Gemini API key here.
3.  Ensure the variable is available for all environments (Production, Preview, Development).
4.  Click **Add**.

### Step 4: Deploy

Click the **Deploy** button. Vercel will start the build process, and once complete, your site will be live. You'll be provided with a URL to access it.

From now on, every time you `git push` to your `main` branch, Vercel will automatically trigger a new deployment with the latest changes.
