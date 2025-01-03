import { Octokit } from "@octokit/rest";
import axios from "axios";
import { readFileSync } from "fs";

(async () => {
  const { INPUT_GITHUB_TOKEN, GITHUB_EVENT_PATH, INPUT_OLLAMA_SERVER_URL } = process.env;

  if (!INPUT_GITHUB_TOKEN || !GITHUB_EVENT_PATH || !INPUT_OLLAMA_SERVER_URL) {
    console.error("Required environment variables are missing.");
    // console.log("GITHUB_TOKEN:", INPUT_GITHUB_TOKEN);
    // console.log("GITHUB_EVENT_PATH:", GITHUB_EVENT_PATH);
    // console.log("OLLAMA_SERVER_URL:", INPUT_OLLAMA_SERVER_URL);
    process.exit(1);
  }

  const octokit = new Octokit({ auth: INPUT_GITHUB_TOKEN });

  const { repository, number } = JSON.parse(
    readFileSync(process.env.GITHUB_EVENT_PATH || "", "utf8")
  );
  const owner = repository.owner.login;
  const repo = repository.name;
  const pullNumber = number;


  // console.log("Owner:", owner);
  // console.log("Repo:", repo);
  // console.log("Pull request number:", pullNumber);

  const diff = await getDiffString(owner, repo, pullNumber, octokit);

  // console.log("Diff:------------------>", diff);


  // const response = await octokit.pulls.get({
  //   owner,
  //   repo,
  //   pull_number: pullNumber,
  //   mediaType: { format: "diff" },
  // });

  // console.log("Pull Request Raw Response Start ----------------------------------------------------------------------------");

  // console.log(response.data);

  // console.log("Pull Request Raw Response End ----------------------------------------------------------------------------");

  // const pullRequest = response.data;
  // const base = pullRequest.base.sha;
  // const head = pullRequest.head.sha;
  // console.log("Base SHA:", base);
  // console.log("Head SHA:", head);


  // // Compare commits between base and head
  // const compareResponse = await octokit.repos.compareCommits({
  //   owner,
  //   repo,
  //   base,
  //   head,
  // });

  // const diffUrl = compareResponse.data.diff_url;

  // const diffResponse = await axios.get(diffUrl, {
  //   headers: {
  //     Accept: "application/vnd.github.v3.diff", // Specify diff format
  //   },
  // });

  // // The raw diff as a string
  // const diffString = diffResponse.data;

  // console.log("Raw Diff:");
  // console.log(diffString);

  // console.log("Pull request diff:", diffString);

  try {

    const prompt = `
Review the following changes in the pull request:

${diff}

Provide constructive feedback and highlight any issues, potential improvements, or best practices that can be applied.

Give response in markdown format
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

    const comments = apiResponse.data.response;

    // console.log("Review response:", apiResponse.data);

    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: pullNumber, // Use `issue_number` for pull request comments
      body: JSON.stringify(comments),
    });
  } catch (error) {
    console.error("Error during code review process:", error);
    process.exit(1);
  }
})();


async function getDiffString(owner, repo, pullNumber, octokit) {
  try {

    const response = await octokit.request(
      "GET /repos/{owner}/{repo}/pulls/{pull_number}",
      {
        owner,
        repo,
        pull_number: pullNumber,
        headers: {
          Accept: "application/vnd.github.v3.diff", // Request diff format
        },
      }
    );

    const diffString = response.data; // The raw diff string
    console.log("Raw Diff String:");
    console.log(diffString);

    return diffString;
  } catch (error) {
    console.error("Error fetching diff string:", error.message);
  }
}