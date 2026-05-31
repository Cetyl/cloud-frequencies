import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";

const config =
    new pulumi.Config("networking");

const vpc =
    config.requireObject<{
        name: string;
    }>("vpc");

export const network =
    new gcp.compute.Network(
        vpc.name,
        {
            name:
                vpc.name,

            autoCreateSubnetworks:
                false,
        }
    );

export const vpcName =
    network.name;

export const vpcId =
    network.id;