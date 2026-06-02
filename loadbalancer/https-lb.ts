import * as pulumi      from "@pulumi/pulumi";
import * as gcp          from "@pulumi/gcp";
import { backendService } from "./backend";

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

const domain =
    config.require("domain");

const ipName =
    config.require("ipName");

/*
|--------------------------------------------------------------------------
| Static IP — already reserved manually
|--------------------------------------------------------------------------
| The IP 8.233.69.95 was reserved before this stack existed.
| Referenced as a data source — Pulumi reads it, does not manage lifecycle.
| Terraform equivalent: data "google_compute_global_address"
*/

const globalIp =
    gcp.compute.GlobalAddress.get(
        ipName,
        pulumi.interpolate`projects/${project}/global/addresses/${ipName}`
    );

/*
|--------------------------------------------------------------------------
| Managed SSL Certificate
|--------------------------------------------------------------------------
| GCP auto-provisions and renews HTTPS cert once DNS resolves to the IP.
| Terraform equivalent: google_compute_managed_ssl_certificate
*/

const sslCert =
    new gcp.compute.ManagedSslCertificate(
        "cloud-frequencies-cert",
        {
            name:
                "cloud-frequencies-cert",

            project:
                project,

            deletionPolicy:
                "DELETE",

            managed: {
                domains: [domain],
            },
        },
        {
            protect: true,
        }
    );

/*
|--------------------------------------------------------------------------
| URL Map — HTTPS
|--------------------------------------------------------------------------
| Routes all HTTPS requests to the backend service.
| Terraform equivalent: google_compute_url_map
*/

const urlMap =
    new gcp.compute.URLMap(
        "cloud-frequencies-url-map",
        {
            name:
                "cloud-frequencies-url-map",

            project:
                project,

            defaultService:
                backendService.id,
        }
    );

/*
|--------------------------------------------------------------------------
| Target HTTPS Proxy
|--------------------------------------------------------------------------
| Terminates TLS using the managed certificate, forwards to URL map.
| Terraform equivalent: google_compute_target_https_proxy
*/

const httpsProxy =
    new gcp.compute.TargetHttpsProxy(
        "cloud-frequencies-https-proxy",
        {
            name:
                "cloud-frequencies-https-proxy",

            project:
                project,

            urlMap:
                urlMap.id,

            sslCertificates:
                [sslCert.id],
        }
    );

/*
|--------------------------------------------------------------------------
| HTTPS Forwarding Rule
|--------------------------------------------------------------------------
| Binds the static IP on port 443 to the HTTPS proxy.
| Terraform equivalent: google_compute_global_forwarding_rule
*/

new gcp.compute.GlobalForwardingRule(
    "cloud-frequencies-https-forwarding",
    {
        name:
            "cloud-frequencies-https-forwarding",

        project:
            project,

        target:
            httpsProxy.id,

        ipAddress:
            globalIp.address,

        portRange:
            "443",

        loadBalancingScheme:
            "EXTERNAL_MANAGED",
    }
);

/*
|--------------------------------------------------------------------------
| Outputs
|--------------------------------------------------------------------------
*/

export const loadBalancerIp =
    globalIp.address;

export const domainUrl =
    `https://${domain}`;
