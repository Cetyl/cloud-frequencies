import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";

import { network } from "./vpc";

const config =
    new pulumi.Config("networking");

const region =
    config.require("region");

const subnet =
    config.requireObject<{
        name: string;
        cidr: string;
    }>("subnet");

export const subnetwork =
    new gcp.compute.Subnetwork(
        subnet.name,
        {
            name:
                subnet.name,

            region:
                region,

            network:
                network.id,

            ipCidrRange:
                subnet.cidr,
        }
    );

export const subnetName =
    subnetwork.name;

export const subnetId =
    subnetwork.id;