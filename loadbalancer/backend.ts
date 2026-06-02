import * as pulumi from "@pulumi/pulumi";
import * as gcp    from "@pulumi/gcp";
import { neg }     from "./neg";

/*
|--------------------------------------------------------------------------
| Config
|--------------------------------------------------------------------------
*/

const project =
    new pulumi.Config("gcp")
        .require("project");

/*
|--------------------------------------------------------------------------
| Backend Service
|--------------------------------------------------------------------------
| Connects the load balancer to the serverless NEG (and through it,
| to Cloud Run). Equivalent to an ALB Target Group in AWS.
| Terraform equivalent: google_compute_backend_service
*/

export const backendService =
    new gcp.compute.BackendService(
        "cloud-frequencies-backend",
        {
            name:
                "cloud-frequencies-backend",

            project:
                project,

            protocol:
                "HTTPS",

            loadBalancingScheme:
                "EXTERNAL_MANAGED",

            backends: [
                {
                    group: neg.id,
                },
            ],
        }
    );
