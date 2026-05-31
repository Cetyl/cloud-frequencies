import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";

const config = new pulumi.Config("storage");

const region = config.require("region");

const bucketNames = config.requireObject<{
    assets: string;
}>("bucketNames");

export const assetsBucket =
    new gcp.storage.Bucket(
        bucketNames.assets,
        {
            location: region,
            uniformBucketLevelAccess: true,
        }
    );

// Make all objects publicly readable via IAM.
// With uniformBucketLevelAccess enabled, per-object ACLs are blocked —
// public access must be granted at the bucket level instead.
// Terraform equivalent: google_storage_bucket_iam_member (allUsers, objectViewer)
new gcp.storage.BucketIAMBinding("assets-bucket-public-read", {
    bucket: assetsBucket.name,
    role: "roles/storage.objectViewer",
    members: ["allUsers"],
});

export const bucketName = assetsBucket.name;
export const bucketUrl = assetsBucket.url;