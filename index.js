import { Octokit } from "@octokit/rest";
import axios from "axios";

(async () => {
  const { GITHUB_TOKEN, GITHUB_EVENT_PATH, OLLAMA_SERVER_URL } = process.env;
  console.log(process.env)

  if (!GITHUB_TOKEN || !GITHUB_EVENT_PATH || !OLLAMA_SERVER_URL) {
    console.error("Required environment variables are missing.");
    console.log("GITHUB_TOKEN:", GITHUB_TOKEN);
    console.log("GITHUB_EVENT_PATH:", GITHUB_EVENT_PATH);
    console.log("OLLAMA_SERVER_URL:", OLLAMA_SERVER_URL);
    process.exit(1);
  }

  const event = require(GITHUB_EVENT_PATH);
  const octokit = new Octokit({ auth: GITHUB_TOKEN });

  const owner = event.repository.owner.login;
  const repo = event.repository.name;
  const pullNumber = event.pull_request.number;

  try {
    // Get the pull request changes
    const { data: files } = await octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: pullNumber,
    });

    // Construct the prompt
    const changes = files
      .map((file) => {
        return `File: ${file.filename}\nChanges:\n${file.patch}`;
      })
      .join("\n\n");

    const prompt = `
Review the following changes in the pull request:

${changes}

Provide constructive feedback and highlight any issues, potential improvements, or best practices that can be applied.
    `;

    // Send the prompt to the Ollama server
    const response = await axios.post(
      `${OLLAMA_SERVER_URL}/api/generate`,
      { "prompt": prompt,
        "model":"llama3.1:8b",
        "stream": false
       },
      { headers: { "Content-Type": "application/json" } }
    );

    console.log("Review response:", response.data);
  } catch (error) {
    console.error("Error during code review process:", error);
    process.exit(1);
  }
})();
