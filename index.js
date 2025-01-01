import axios from "axios";

(async () => {
  const { INPUT_GITHUB_TOKEN, GITHUB_EVENT_PATH, INPUT_OLLAMA_SERVER_URL } = process.env;

  if (!INPUT_GITHUB_TOKEN || !GITHUB_EVENT_PATH || !INPUT_OLLAMA_SERVER_URL) {
    console.error("Required environment variables are missing.");
    console.log("GITHUB_TOKEN:", INPUT_GITHUB_TOKEN);
    console.log("GITHUB_EVENT_PATH:", GITHUB_EVENT_PATH);
    console.log("OLLAMA_SERVER_URL:", INPUT_OLLAMA_SERVER_URL);
    process.exit(1);
  }

  const { repository, number } = JSON.parse(
    readFileSync(process.env.GITHUB_EVENT_PATH || "", "utf8")
  );
  const owner = repository.owner.login;
  const repo = repository.name;
  const pullNumber = number;

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
      `${INPUT_OLLAMA_SERVER_URL}/api/generate`,
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
