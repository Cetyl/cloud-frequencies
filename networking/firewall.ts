import * as gcp from "@pulumi/gcp";

import { network } from "./vpc";

export const allowHttp =
    new gcp.compute.Firewall(
        "allow-http",
        {
            name:
                "allow-http",

            network:
                network.id,

            allows: [
                {
                    protocol:
                        "tcp",

                    ports:
                        [
                            "80",
                            "443",
                        ],
                },
            ],

            sourceRanges:
                [
                    "0.0.0.0/0",
                ],
        }
    );