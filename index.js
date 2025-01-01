import { Octokit } from "@octokit/rest";
import axios from "axios";
import { readFileSync } from "fs";
import parseDiff from "parse-diff";

(async () => {
  const { INPUT_GITHUB_TOKEN, GITHUB_EVENT_PATH, INPUT_OLLAMA_SERVER_URL } = process.env;

  if (!INPUT_GITHUB_TOKEN || !GITHUB_EVENT_PATH || !INPUT_OLLAMA_SERVER_URL) {
    console.error("Required environment variables are missing.");
    console.log("GITHUB_TOKEN:", INPUT_GITHUB_TOKEN);
    console.log("GITHUB_EVENT_PATH:", GITHUB_EVENT_PATH);
    console.log("OLLAMA_SERVER_URL:", INPUT_OLLAMA_SERVER_URL);
    process.exit(1);
  }

  const octokit = new Octokit({ auth: INPUT_GITHUB_TOKEN });

  const { repository, number } = JSON.parse(
    readFileSync(process.env.GITHUB_EVENT_PATH || "", "utf8")
  );
  const owner = repository.owner.login;
  const repo = repository.name;
  const pullNumber = number;


  console.log("Owner:", owner);
  console.log("Repo:", repo);
  console.log("Pull request number:", pullNumber);


  const response = await octokit.pulls.get({
    owner,
    repo,
    pullNumber
  });

  console.log("Pull Request Raw Response Start ----------------------------------------------------------------------------");

  console.log(response);

  console.log("Pull Request Raw Response End ----------------------------------------------------------------------------");

  const pullRequest = response.data;
  const base = pullRequest.base.sha;
  const head = pullRequest.head.sha;

  // Compare commits between base and head
  const { data: diff } = await octokit.repos.compareCommits({
    owner,
    repo,
    base,
    head,
  });

  console.log("Diff details:", diff);
  
  
  const parsedDiff = parseDiff(response.data);

  console.log("Pull request diff:", parsedDiff);

  try {

    const prompt = `
Review the following changes in the pull request:

${filteredDiff}

Provide constructive feedback and highlight any issues, potential improvements, or best practices that can be applied.
    `;

    // Send the prompt to the Ollama server
    const apiResponse = await axios.post(
      `${INPUT_OLLAMA_SERVER_URL}/api/generate`,
      { "prompt": prompt,
        "model":"llama3.1:8b",
        "stream": false
       },
      { headers: { "Content-Type": "application/json" } }
    );

    const comments = apiResponse.data;

    console.log("Review response:", apiResponse.data);


    await octokit.pulls.createReview({
      owner,
      repo,
      pullNumber,
      comments,
      event: "COMMENT",
    });
  } catch (error) {
    console.error("Error during code review process:", error);
    process.exit(1);
  }
})();
