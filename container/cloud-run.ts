import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";

/*
|--------------------------------------------------------------------------
| Config
|--------------------------------------------------------------------------
*/

const config =
    new pulumi.Config("container");

const region =
    config.require("region");

const project =
    new pulumi.Config("gcp")
        .require("project");

const image =
    config.requireObject<{
        name: string;
        tag: string;
    }>("image");

const artifactRegistry =
    config.requireObject<{
        repository: string;
    }>("artifactRegistry");

const cloudRun =
    config.requireObject<{
        serviceName: string;
    }>("cloudRun");

/*
|--------------------------------------------------------------------------
| Security Stack
|--------------------------------------------------------------------------
*/

const securityStack =
    new pulumi.StackReference(
        "Cetyl/security/dev"
    );

const serviceAccountEmail =
    securityStack.getOutput(
        "cloudRunServiceAccountEmail"
    );

/*
|--------------------------------------------------------------------------
| Storage Stack
|--------------------------------------------------------------------------
*/

const storageStack =
    new pulumi.StackReference(
        "Cetyl/storage/dev"
    );

const bucketName =
    storageStack.getOutput(
        "bucketName"
    );

const bucketUrl =
    storageStack.getOutput(
        "bucketUrl"
    );

/*
|--------------------------------------------------------------------------
| Networking Stack
|--------------------------------------------------------------------------
*/

const networkingStack =
    new pulumi.StackReference(
        "Cetyl/networking/dev"
    );

const connectorName =
    networkingStack.getOutput(
        "serverlessVpcConnectorName"
    );

const vpcConnector =
    pulumi.interpolate`projects/${project}/locations/${region}/connectors/${connectorName}`;

/*
|--------------------------------------------------------------------------
| Secret Manager — Gemini API Key
|--------------------------------------------------------------------------
| The secret itself is created once manually:
|   gcloud secrets create gemini-api-key \
|     --project=strata-493811 \
|     --replication-policy=automatic
|
|   echo -n "YOUR_KEY" | gcloud secrets versions add gemini-api-key \
|     --project=strata-493811 --data-file=-
|
| Pulumi only manages the IAM binding that lets Cloud Run read it.
| In Terraform this would be: google_secret_manager_secret_iam_member
*/

new gcp.secretmanager.SecretIamMember(
    "cloud-run-sa-gemini-key-access",
    {
        project:  project,
        secretId: "gemini-api-key",
        role:     "roles/secretmanager.secretAccessor",
        member:   serviceAccountEmail.apply(
            email => `serviceAccount:${email}`
        ),
    }
);

/*
|--------------------------------------------------------------------------
| Docker Image
|--------------------------------------------------------------------------
*/

const imagePath =
    `${region}-docker.pkg.dev/${project}/${artifactRegistry.repository}/${image.name}:${image.tag}`;

/*
|--------------------------------------------------------------------------
| Cloud Run
|--------------------------------------------------------------------------
*/

export const cloudRunService =
    new gcp.cloudrunv2.Service(
        cloudRun.serviceName,
        {
            name:
                cloudRun.serviceName,

            location:
                region,

            template: {

                serviceAccount:
                    serviceAccountEmail,

                vpcAccess: {

                    connector:
                        vpcConnector,

                    egress:
                        "PRIVATE_RANGES_ONLY",
                },

                containers: [
                    {
                        image:
                            imagePath,

                        envs: [
                            {
                                name:
                                    "BUCKET_NAME",

                                value:
                                    bucketName,
                            },

                            {
                                name:
                                    "BUCKET_URL",

                                value:
                                    bucketUrl,
                            },

                            {
                                name:
                                    "GCP_PROJECT",

                                value:
                                    project,
                            },

                            // GEMINI_API_KEY is pulled from Secret Manager at runtime.
                            // Cloud Run fetches the latest version of the secret and
                            // injects it as an env var — it never appears in Pulumi
                            // state or source code.
                            // In Terraform: google_cloud_run_v2_service → template →
                            // containers → env → value_source → secret_key_ref
                            {
                                name: "GEMINI_API_KEY",
                                valueSource: {
                                    secretKeyRef: {
                                        secret:  "gemini-api-key",
                                        version: "latest",
                                    },
                                },
                            },
                        ],
                    },
                ],
            },
        }
    );

/*
|--------------------------------------------------------------------------
| Public Invoker — allow anyone to call the Cloud Run service
|--------------------------------------------------------------------------
| Without this, all requests require a Bearer token. This makes the
| endpoint publicly accessible so the frontend can call it directly.
*/

new gcp.cloudrunv2.ServiceIamBinding(
    "cloud-run-public-invoker",
    {
        name:
            cloudRunService.name,

        location:
            region,

        role:
            "roles/run.invoker",

        members:
            ["allUsers"],
    }
);

/*
|--------------------------------------------------------------------------
| Outputs
|--------------------------------------------------------------------------
*/

export const cloudRunUrl =
    cloudRunService.uri;

export const cloudRunName =
    cloudRunService.name;