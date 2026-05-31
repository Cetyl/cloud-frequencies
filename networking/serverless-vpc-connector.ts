import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";

import { network } from "./vpc";

const config =
    new pulumi.Config("networking");

const region =
    config.require("region");

const connector =
    config.requireObject<{
        name: string;
        cidr: string;
    }>("vpcConnector");

export const serverlessVpcConnector =
    new gcp.vpcaccess.Connector(
        connector.name,
        {
            name:
                connector.name,

            region:
                region,

            network:
                network.name,

            ipCidrRange:
                connector.cidr,

            machineType:
                "e2-micro",

            minInstances:
                2,

            maxInstances:
                3,
        }
    );

export const serverlessVpcConnectorName =
    serverlessVpcConnector.name;

export const serverlessVpcConnectorId =
    serverlessVpcConnector.id;