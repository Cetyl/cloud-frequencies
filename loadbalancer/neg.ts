import * as pulumi from "@pulumi/pulumi";
import * as gcp    from "@pulumi/gcp";

/*
|--------------------------------------------------------------------------
| Config
|--------------------------------------------------------------------------
*/

const config =
    new pulumi.Config("loadbalancer");

const project =
    new pulumi.Config("gcp")
        .require("project");

const region =
    config.require("region");

/*
|--------------------------------------------------------------------------
| Container Stack
|--------------------------------------------------------------------------
*/

const containerStack =
    new pulumi.StackReference(
        "Cetyl/container/dev"
    );

const cloudRunServiceName =
    containerStack.getOutput(
        "cloudRunName"
    );

/*
|--------------------------------------------------------------------------
| Serverless NEG
|--------------------------------------------------------------------------
| Points the load balancer at the Cloud Run service by name.
| No IPs to register — Cloud Run is serverless.
| Terraform equivalent: google_compute_region_network_endpoint_group
*/

export const neg =
    new gcp.compute.RegionNetworkEndpointGroup(
        "cloud-frequencies-neg",
        {
            name:
                "cloud-frequencies-neg",

            networkEndpointType:
                "SERVERLESS",

            region:
                region,

            project:
                project,

            cloudRun: {
                service: cloudRunServiceName,
            },
        }
    );
