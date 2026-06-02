import * as pulumi from "@pulumi/pulumi";
import * as gcp    from "@pulumi/gcp";
import { loadBalancerIp } from "./https-lb";

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
| HTTP → HTTPS Redirect URL Map
|--------------------------------------------------------------------------
| Any plain HTTP request is permanently redirected to HTTPS.
| Terraform equivalent: google_compute_url_map with default_url_redirect
*/

const httpRedirectMap =
    new gcp.compute.URLMap(
        "cloud-frequencies-http-redirect",
        {
            name:
                "cloud-frequencies-http-redirect",

            project:
                project,

            defaultUrlRedirect: {
                httpsRedirect: true,
                stripQuery:    false,
            },
        }
    );

/*
|--------------------------------------------------------------------------
| HTTP Target Proxy
|--------------------------------------------------------------------------
| Receives plain HTTP and passes it to the redirect URL map.
| Terraform equivalent: google_compute_target_http_proxy
*/

const httpProxy =
    new gcp.compute.TargetHttpProxy(
        "cloud-frequencies-http-proxy",
        {
            name:
                "cloud-frequencies-http-proxy",

            project:
                project,

            urlMap:
                httpRedirectMap.id,
        }
    );

/*
|--------------------------------------------------------------------------
| HTTP Forwarding Rule
|--------------------------------------------------------------------------
| Binds the same static IP on port 80 to the HTTP redirect proxy.
| Terraform equivalent: google_compute_global_forwarding_rule
*/

new gcp.compute.GlobalForwardingRule(
    "cloud-frequencies-http-forwarding",
    {
        name:
            "cloud-frequencies-http-forwarding",

        project:
            project,

        target:
            httpProxy.id,

        ipAddress:
            loadBalancerIp,

        portRange:
            "80",

        loadBalancingScheme:
            "EXTERNAL_MANAGED",
    }
);
