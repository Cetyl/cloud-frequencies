import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";

const config =
    new pulumi.Config("container");

const region =
    config.require("region");

const artifactRegistry =
    config.requireObject<{
        repository: string;
    }>("artifactRegistry");

export const repository =
    new gcp.artifactregistry.Repository(
        artifactRegistry.repository,
        {
            repositoryId:
                artifactRegistry.repository,

            location:
                region,

            format:
                "DOCKER",

            description:
                "Cloud Frequencies Docker Repository",
        }
    );

export const repositoryName =
    repository.name;

export const repositoryLocation =
    repository.location;