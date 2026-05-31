import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";

const config =
    new pulumi.Config("security");

const project =
    new pulumi.Config("gcp").require("project");

const serviceAccounts =
    config.requireObject<{
        cloudRun: string;
    }>("serviceAccounts");

/*
|--------------------------------------------------------------------------
| Service Account
|--------------------------------------------------------------------------
*/

export const cloudRunServiceAccount =
    new gcp.serviceaccount.Account(
        serviceAccounts.cloudRun,
        {
            accountId:
                serviceAccounts.cloudRun,

            displayName:
                "Cloud Run Service Account",
        }
    );

export const cloudRunServiceAccountEmail =
    cloudRunServiceAccount.email;

/*
|--------------------------------------------------------------------------
| IAM — Vertex AI (Gemini + Imagen)
|--------------------------------------------------------------------------
| Allows cloud-run-sa to call Vertex AI APIs.
| One role covers both Gemini (audio analysis) and Imagen (poster generation).
*/

export const vertexAiIamBinding =
    new gcp.projects.IAMMember(
        "cloud-run-sa-vertex-ai",
        {
            project: project,

            role: "roles/aiplatform.user",

            member: cloudRunServiceAccount.email.apply(
                email => `serviceAccount:${email}`
            ),
        }
    );

/*
|--------------------------------------------------------------------------
| IAM — Cloud Storage (write generated posters)
|--------------------------------------------------------------------------
| Allows cloud-run-sa to upload generated poster images to the GCS bucket.
*/

export const storageIamBinding =
    new gcp.projects.IAMMember(
        "cloud-run-sa-storage-admin",
        {
            project: project,

            role: "roles/storage.objectAdmin",

            member: cloudRunServiceAccount.email.apply(
                email => `serviceAccount:${email}`
            ),
        }
    );
