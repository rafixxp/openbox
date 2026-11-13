import { WaiterResult } from "@smithy/core/client";
import {
  HttpHandlerOptions as __HttpHandlerOptions,
  MetricsRecorder as __MetricsRecorder,
  PaginationConfiguration,
  Paginator,
  WaiterConfiguration,
} from "@smithy/types";
import {
  AbortMultipartUploadCommandInput,
  AbortMultipartUploadCommandOutput,
} from "./commands/AbortMultipartUploadCommand";
import {
  CompleteMultipartUploadCommandInput,
  CompleteMultipartUploadCommandOutput,
} from "./commands/CompleteMultipartUploadCommand";
import { CopyObjectCommandInput, CopyObjectCommandOutput } from "./commands/CopyObjectCommand";
import {
  CreateBucketCommandInput,
  CreateBucketCommandOutput,
} from "./commands/CreateBucketCommand";
import {
  CreateBucketMetadataConfigurationCommandInput,
  CreateBucketMetadataConfigurationCommandOutput,
} from "./commands/CreateBucketMetadataConfigurationCommand";
import {
  CreateBucketMetadataTableConfigurationCommandInput,
  CreateBucketMetadataTableConfigurationCommandOutput,
} from "./commands/CreateBucketMetadataTableConfigurationCommand";
import {
  CreateMultipartUploadCommandInput,
  CreateMultipartUploadCommandOutput,
} from "./commands/CreateMultipartUploadCommand";
import {
  CreateSessionCommandInput,
  CreateSessionCommandOutput,
} from "./commands/CreateSessionCommand";
import {
  DeleteBucketAnalyticsConfigurationCommandInput,
  DeleteBucketAnalyticsConfigurationCommandOutput,
} from "./commands/DeleteBucketAnalyticsConfigurationCommand";
import {
  DeleteBucketCommandInput,
  DeleteBucketCommandOutput,
} from "./commands/DeleteBucketCommand";
import {
  DeleteBucketCorsCommandInput,
  DeleteBucketCorsCommandOutput,
} from "./commands/DeleteBucketCorsCommand";
import {
  DeleteBucketEncryptionCommandInput,
  DeleteBucketEncryptionCommandOutput,
} from "./commands/DeleteBucketEncryptionCommand";
import {
  DeleteBucketIntelligentTieringConfigurationCommandInput,
  DeleteBucketIntelligentTieringConfigurationCommandOutput,
} from "./commands/DeleteBucketIntelligentTieringConfigurationCommand";
import {
  DeleteBucketInventoryConfigurationCommandInput,
  DeleteBucketInventoryConfigurationCommandOutput,
} from "./commands/DeleteBucketInventoryConfigurationCommand";
import {
  DeleteBucketLifecycleCommandInput,
  DeleteBucketLifecycleCommandOutput,
} from "./commands/DeleteBucketLifecycleCommand";
import {
  DeleteBucketMetadataConfigurationCommandInput,
  DeleteBucketMetadataConfigurationCommandOutput,
} from "./commands/DeleteBucketMetadataConfigurationCommand";
import {
  DeleteBucketMetadataTableConfigurationCommandInput,
  DeleteBucketMetadataTableConfigurationCommandOutput,
} from "./commands/DeleteBucketMetadataTableConfigurationCommand";
import {
  DeleteBucketMetricsConfigurationCommandInput,
  DeleteBucketMetricsConfigurationCommandOutput,
} from "./commands/DeleteBucketMetricsConfigurationCommand";
import {
  DeleteBucketOwnershipControlsCommandInput,
  DeleteBucketOwnershipControlsCommandOutput,
} from "./commands/DeleteBucketOwnershipControlsCommand";
import {
  DeleteBucketPolicyCommandInput,
  DeleteBucketPolicyCommandOutput,
} from "./commands/DeleteBucketPolicyCommand";
import {
  DeleteBucketReplicationCommandInput,
  DeleteBucketReplicationCommandOutput,
} from "./commands/DeleteBucketReplicationCommand";
import {
  DeleteBucketTaggingCommandInput,
  DeleteBucketTaggingCommandOutput,
} from "./commands/DeleteBucketTaggingCommand";
import {
  DeleteBucketWebsiteCommandInput,
  DeleteBucketWebsiteCommandOutput,
} from "./commands/DeleteBucketWebsiteCommand";
import {
  DeleteObjectAnnotationCommandInput,
  DeleteObjectAnnotationCommandOutput,
} from "./commands/DeleteObjectAnnotationCommand";
import {
  DeleteObjectCommandInput,
  DeleteObjectCommandOutput,
} from "./commands/DeleteObjectCommand";
import {
  DeleteObjectsCommandInput,
  DeleteObjectsCommandOutput,
} from "./commands/DeleteObjectsCommand";
import {
  DeleteObjectTaggingCommandInput,
  DeleteObjectTaggingCommandOutput,
} from "./commands/DeleteObjectTaggingCommand";
import {
  DeletePublicAccessBlockCommandInput,
  DeletePublicAccessBlockCommandOutput,
} from "./commands/DeletePublicAccessBlockCommand";
import {
  GetBucketAbacCommandInput,
  GetBucketAbacCommandOutput,
} from "./commands/GetBucketAbacCommand";
import {
  GetBucketAccelerateConfigurationCommandInput,
  GetBucketAccelerateConfigurationCommandOutput,
} from "./commands/GetBucketAccelerateConfigurationCommand";
import {
  GetBucketAclCommandInput,
  GetBucketAclCommandOutput,
} from "./commands/GetBucketAclCommand";
import {
  GetBucketAnalyticsConfigurationCommandInput,
  GetBucketAnalyticsConfigurationCommandOutput,
} from "./commands/GetBucketAnalyticsConfigurationCommand";
import {
  GetBucketCorsCommandInput,
  GetBucketCorsCommandOutput,
} from "./commands/GetBucketCorsCommand";
import {
  GetBucketEncryptionCommandInput,
  GetBucketEncryptionCommandOutput,
} from "./commands/GetBucketEncryptionCommand";
import {
  GetBucketIntelligentTieringConfigurationCommandInput,
  GetBucketIntelligentTieringConfigurationCommandOutput,
} from "./commands/GetBucketIntelligentTieringConfigurationCommand";
import {
  GetBucketInventoryConfigurationCommandInput,
  GetBucketInventoryConfigurationCommandOutput,
} from "./commands/GetBucketInventoryConfigurationCommand";
import {
  GetBucketLifecycleConfigurationCommandInput,
  GetBucketLifecycleConfigurationCommandOutput,
} from "./commands/GetBucketLifecycleConfigurationCommand";
import {
  GetBucketLocationCommandInput,
  GetBucketLocationCommandOutput,
} from "./commands/GetBucketLocationCommand";
import {
  GetBucketLoggingCommandInput,
  GetBucketLoggingCommandOutput,
} from "./commands/GetBucketLoggingCommand";
import {
  GetBucketMetadataConfigurationCommandInput,
  GetBucketMetadataConfigurationCommandOutput,
} from "./commands/GetBucketMetadataConfigurationCommand";
import {
  GetBucketMetadataTableConfigurationCommandInput,
  GetBucketMetadataTableConfigurationCommandOutput,
} from "./commands/GetBucketMetadataTableConfigurationCommand";
import {
  GetBucketMetricsConfigurationCommandInput,
  GetBucketMetricsConfigurationCommandOutput,
} from "./commands/GetBucketMetricsConfigurationCommand";
import {
  GetBucketNotificationConfigurationCommandInput,
  GetBucketNotificationConfigurationCommandOutput,
} from "./commands/GetBucketNotificationConfigurationCommand";
import {
  GetBucketOwnershipControlsCommandInput,
  GetBucketOwnershipControlsCommandOutput,
} from "./commands/GetBucketOwnershipControlsCommand";
import {
  GetBucketPolicyCommandInput,
  GetBucketPolicyCommandOutput,
} from "./commands/GetBucketPolicyCommand";
import {
  GetBucketPolicyStatusCommandInput,
  GetBucketPolicyStatusCommandOutput,
} from "./commands/GetBucketPolicyStatusCommand";
import {
  GetBucketReplicationCommandInput,
  GetBucketReplicationCommandOutput,
} from "./commands/GetBucketReplicationCommand";
import {
  GetBucketRequestPaymentCommandInput,
  GetBucketRequestPaymentCommandOutput,
} from "./commands/GetBucketRequestPaymentCommand";
import {
  GetBucketTaggingCommandInput,
  GetBucketTaggingCommandOutput,
} from "./commands/GetBucketTaggingCommand";
import {
  GetBucketVersioningCommandInput,
  GetBucketVersioningCommandOutput,
} from "./commands/GetBucketVersioningCommand";
import {
  GetBucketWebsiteCommandInput,
  GetBucketWebsiteCommandOutput,
} from "./commands/GetBucketWebsiteCommand";
import {
  GetObjectAclCommandInput,
  GetObjectAclCommandOutput,
} from "./commands/GetObjectAclCommand";
import {
  GetObjectAnnotationCommandInput,
  GetObjectAnnotationCommandOutput,
} from "./commands/GetObjectAnnotationCommand";
import {
  GetObjectAttributesCommandInput,
  GetObjectAttributesCommandOutput,
} from "./commands/GetObjectAttributesCommand";
import { GetObjectCommandInput, GetObjectCommandOutput } from "./commands/GetObjectCommand";
import {
  GetObjectLegalHoldCommandInput,
  GetObjectLegalHoldCommandOutput,
} from "./commands/GetObjectLegalHoldCommand";
import {
  GetObjectLockConfigurationCommandInput,
  GetObjectLockConfigurationCommandOutput,
} from "./commands/GetObjectLockConfigurationCommand";
import {
  GetObjectRetentionCommandInput,
  GetObjectRetentionCommandOutput,
} from "./commands/GetObjectRetentionCommand";
import {
  GetObjectTaggingCommandInput,
  GetObjectTaggingCommandOutput,
} from "./commands/GetObjectTaggingCommand";
import {
  GetObjectTorrentCommandInput,
  GetObjectTorrentCommandOutput,
} from "./commands/GetObjectTorrentCommand";
import {
  GetPublicAccessBlockCommandInput,
  GetPublicAccessBlockCommandOutput,
} from "./commands/GetPublicAccessBlockCommand";
import { HeadBucketCommandInput, HeadBucketCommandOutput } from "./commands/HeadBucketCommand";
import { HeadObjectCommandInput, HeadObjectCommandOutput } from "./commands/HeadObjectCommand";
import {
  ListBucketAnalyticsConfigurationsCommandInput,
  ListBucketAnalyticsConfigurationsCommandOutput,
} from "./commands/ListBucketAnalyticsConfigurationsCommand";
import {
  ListBucketIntelligentTieringConfigurationsCommandInput,
  ListBucketIntelligentTieringConfigurationsCommandOutput,
} from "./commands/ListBucketIntelligentTieringConfigurationsCommand";
import {
  ListBucketInventoryConfigurationsCommandInput,
  ListBucketInventoryConfigurationsCommandOutput,
} from "./commands/ListBucketInventoryConfigurationsCommand";
import {
  ListBucketMetricsConfigurationsCommandInput,
  ListBucketMetricsConfigurationsCommandOutput,
} from "./commands/ListBucketMetricsConfigurationsCommand";
import { ListBucketsCommandInput, ListBucketsCommandOutput } from "./commands/ListBucketsCommand";
import {
  ListDirectoryBucketsCommandInput,
  ListDirectoryBucketsCommandOutput,
} from "./commands/ListDirectoryBucketsCommand";
import {
  ListMultipartUploadsCommandInput,
  ListMultipartUploadsCommandOutput,
} from "./commands/ListMultipartUploadsCommand";
import {
  ListObjectAnnotationsCommandInput,
  ListObjectAnnotationsCommandOutput,
} from "./commands/ListObjectAnnotationsCommand";
import { ListObjectsCommandInput, ListObjectsCommandOutput } from "./commands/ListObjectsCommand";
import {
  ListObjectsV2CommandInput,
  ListObjectsV2CommandOutput,
} from "./commands/ListObjectsV2Command";
import {
  ListObjectVersionsCommandInput,
  ListObjectVersionsCommandOutput,
} from "./commands/ListObjectVersionsCommand";
import { ListPartsCommandInput, ListPartsCommandOutput } from "./commands/ListPartsCommand";
import {
  PutBucketAbacCommandInput,
  PutBucketAbacCommandOutput,
} from "./commands/PutBucketAbacCommand";
import {
  PutBucketAccelerateConfigurationCommandInput,
  PutBucketAccelerateConfigurationCommandOutput,
} from "./commands/PutBucketAccelerateConfigurationCommand";
import {
  PutBucketAclCommandInput,
  PutBucketAclCommandOutput,
} from "./commands/PutBucketAclCommand";
import {
  PutBucketAnalyticsConfigurationCommandInput,
  PutBucketAnalyticsConfigurationCommandOutput,
} from "./commands/PutBucketAnalyticsConfigurationCommand";
import {
  PutBucketCorsCommandInput,
  PutBucketCorsCommandOutput,
} from "./commands/PutBucketCorsCommand";
import {
  PutBucketEncryptionCommandInput,
  PutBucketEncryptionCommandOutput,
} from "./commands/PutBucketEncryptionCommand";
import {
  PutBucketIntelligentTieringConfigurationCommandInput,
  PutBucketIntelligentTieringConfigurationCommandOutput,
} from "./commands/PutBucketIntelligentTieringConfigurationCommand";
import {
  PutBucketInventoryConfigurationCommandInput,
  PutBucketInventoryConfigurationCommandOutput,
} from "./commands/PutBucketInventoryConfigurationCommand";
import {
  PutBucketLifecycleConfigurationCommandInput,
  PutBucketLifecycleConfigurationCommandOutput,
} from "./commands/PutBucketLifecycleConfigurationCommand";
import {
  PutBucketLoggingCommandInput,
  PutBucketLoggingCommandOutput,
} from "./commands/PutBucketLoggingCommand";
import {
  PutBucketMetricsConfigurationCommandInput,
  PutBucketMetricsConfigurationCommandOutput,
} from "./commands/PutBucketMetricsConfigurationCommand";
import {
  PutBucketNotificationConfigurationCommandInput,
  PutBucketNotificationConfigurationCommandOutput,
} from "./commands/PutBucketNotificationConfigurationCommand";
import {
  PutBucketOwnershipControlsCommandInput,
  PutBucketOwnershipControlsCommandOutput,
} from "./commands/PutBucketOwnershipControlsCommand";
import {
  PutBucketPolicyCommandInput,
  PutBucketPolicyCommandOutput,
} from "./commands/PutBucketPolicyCommand";
import {
  PutBucketReplicationCommandInput,
  PutBucketReplicationCommandOutput,
} from "./commands/PutBucketReplicationCommand";
import {
  PutBucketRequestPaymentCommandInput,
  PutBucketRequestPaymentCommandOutput,
} from "./commands/PutBucketRequestPaymentCommand";
import {
  PutBucketTaggingCommandInput,
  PutBucketTaggingCommandOutput,
} from "./commands/PutBucketTaggingCommand";
import {
  PutBucketVersioningCommandInput,
  PutBucketVersioningCommandOutput,
} from "./commands/PutBucketVersioningCommand";
import {
  PutBucketWebsiteCommandInput,
  PutBucketWebsiteCommandOutput,
} from "./commands/PutBucketWebsiteCommand";
import {
  PutObjectAclCommandInput,
  PutObjectAclCommandOutput,
} from "./commands/PutObjectAclCommand";
import {
  PutObjectAnnotationCommandInput,
  PutObjectAnnotationCommandOutput,
} from "./commands/PutObjectAnnotationCommand";
import { PutObjectCommandInput, PutObjectCommandOutput } from "./commands/PutObjectCommand";
import {
  PutObjectLegalHoldCommandInput,
  PutObjectLegalHoldCommandOutput,
} from "./commands/PutObjectLegalHoldCommand";
import {
  PutObjectLockConfigurationCommandInput,
  PutObjectLockConfigurationCommandOutput,
} from "./commands/PutObjectLockConfigurationCommand";
import {
  PutObjectRetentionCommandInput,
  PutObjectRetentionCommandOutput,
} from "./commands/PutObjectRetentionCommand";
import {
  PutObjectTaggingCommandInput,
  PutObjectTaggingCommandOutput,
} from "./commands/PutObjectTaggingCommand";
import {
  PutPublicAccessBlockCommandInput,
  PutPublicAccessBlockCommandOutput,
} from "./commands/PutPublicAccessBlockCommand";
import {
  RenameObjectCommandInput,
  RenameObjectCommandOutput,
} from "./commands/RenameObjectCommand";
import {
  RestoreObjectCommandInput,
  RestoreObjectCommandOutput,
} from "./commands/RestoreObjectCommand";
import {
  SelectObjectContentCommandInput,
  SelectObjectContentCommandOutput,
} from "./commands/SelectObjectContentCommand";
import {
  UpdateBucketMetadataAnnotationTableConfigurationCommandInput,
  UpdateBucketMetadataAnnotationTableConfigurationCommandOutput,
} from "./commands/UpdateBucketMetadataAnnotationTableConfigurationCommand";
import {
  UpdateBucketMetadataInventoryTableConfigurationCommandInput,
  UpdateBucketMetadataInventoryTableConfigurationCommandOutput,
} from "./commands/UpdateBucketMetadataInventoryTableConfigurationCommand";
import {
  UpdateBucketMetadataJournalTableConfigurationCommandInput,
  UpdateBucketMetadataJournalTableConfigurationCommandOutput,
} from "./commands/UpdateBucketMetadataJournalTableConfigurationCommand";
import {
  UpdateObjectEncryptionCommandInput,
  UpdateObjectEncryptionCommandOutput,
} from "./commands/UpdateObjectEncryptionCommand";
import { UploadPartCommandInput, UploadPartCommandOutput } from "./commands/UploadPartCommand";
import {
  UploadPartCopyCommandInput,
  UploadPartCopyCommandOutput,
} from "./commands/UploadPartCopyCommand";
import {
  WriteGetObjectResponseCommandInput,
  WriteGetObjectResponseCommandOutput,
} from "./commands/WriteGetObjectResponseCommand";
import { NotFound } from "./models/errors";
import { S3Client } from "./S3Client";
export interface S3RequestOptions extends __HttpHandlerOptions {
  metricsRecorder?: __MetricsRecorder<unknown>;
}
export interface S3 {
  abortMultipartUpload(
    args: AbortMultipartUploadCommandInput,
    options?: S3RequestOptions,
  ): Promise<AbortMultipartUploadCommandOutput>;
  abortMultipartUpload(
    args: AbortMultipartUploadCommandInput,
    cb: (err: any, data?: AbortMultipartUploadCommandOutput) => void,
  ): void;
  abortMultipartUpload(
    args: AbortMultipartUploadCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: AbortMultipartUploadCommandOutput) => void,
  ): void;
  completeMultipartUpload(
    args: CompleteMultipartUploadCommandInput,
    options?: S3RequestOptions,
  ): Promise<CompleteMultipartUploadCommandOutput>;
  completeMultipartUpload(
    args: CompleteMultipartUploadCommandInput,
    cb: (err: any, data?: CompleteMultipartUploadCommandOutput) => void,
  ): void;
  completeMultipartUpload(
    args: CompleteMultipartUploadCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: CompleteMultipartUploadCommandOutput) => void,
  ): void;
  copyObject(
    args: CopyObjectCommandInput,
    options?: S3RequestOptions,
  ): Promise<CopyObjectCommandOutput>;
  copyObject(
    args: CopyObjectCommandInput,
    cb: (err: any, data?: CopyObjectCommandOutput) => void,
  ): void;
  copyObject(
    args: CopyObjectCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: CopyObjectCommandOutput) => void,
  ): void;
  createBucket(
    args: CreateBucketCommandInput,
    options?: S3RequestOptions,
  ): Promise<CreateBucketCommandOutput>;
  createBucket(
    args: CreateBucketCommandInput,
    cb: (err: any, data?: CreateBucketCommandOutput) => void,
  ): void;
  createBucket(
    args: CreateBucketCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: CreateBucketCommandOutput) => void,
  ): void;
  createBucketMetadataConfiguration(
    args: CreateBucketMetadataConfigurationCommandInput,
    options?: S3RequestOptions,
  ): Promise<CreateBucketMetadataConfigurationCommandOutput>;
  createBucketMetadataConfiguration(
    args: CreateBucketMetadataConfigurationCommandInput,
    cb: (err: any, data?: CreateBucketMetadataConfigurationCommandOutput) => void,
  ): void;
  createBucketMetadataConfiguration(
    args: CreateBucketMetadataConfigurationCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: CreateBucketMetadataConfigurationCommandOutput) => void,
  ): void;
  createBucketMetadataTableConfiguration(
    args: CreateBucketMetadataTableConfigurationCommandInput,
    options?: S3RequestOptions,
  ): Promise<CreateBucketMetadataTableConfigurationCommandOutput>;
  createBucketMetadataTableConfiguration(
    args: CreateBucketMetadataTableConfigurationCommandInput,
    cb: (err: any, data?: CreateBucketMetadataTableConfigurationCommandOutput) => void,
  ): void;
  createBucketMetadataTableConfiguration(
    args: CreateBucketMetadataTableConfigurationCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: CreateBucketMetadataTableConfigurationCommandOutput) => void,
  ): void;
  createMultipartUpload(
    args: CreateMultipartUploadCommandInput,
    options?: S3RequestOptions,
  ): Promise<CreateMultipartUploadCommandOutput>;
  createMultipartUpload(
    args: CreateMultipartUploadCommandInput,
    cb: (err: any, data?: CreateMultipartUploadCommandOutput) => void,
  ): void;
  createMultipartUpload(
    args: CreateMultipartUploadCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: CreateMultipartUploadCommandOutput) => void,
  ): void;
  createSession(
    args: CreateSessionCommandInput,
    options?: S3RequestOptions,
  ): Promise<CreateSessionCommandOutput>;
  createSession(
    args: CreateSessionCommandInput,
    cb: (err: any, data?: CreateSessionCommandOutput) => void,
  ): void;
  createSession(
    args: CreateSessionCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: CreateSessionCommandOutput) => void,
  ): void;
  deleteBucket(
    args: DeleteBucketCommandInput,
    options?: S3RequestOptions,
  ): Promise<DeleteBucketCommandOutput>;
  deleteBucket(
    args: DeleteBucketCommandInput,
    cb: (err: any, data?: DeleteBucketCommandOutput) => void,
  ): void;
  deleteBucket(
    args: DeleteBucketCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: DeleteBucketCommandOutput) => void,
  ): void;
  deleteBucketAnalyticsConfiguration(
    args: DeleteBucketAnalyticsConfigurationCommandInput,
    options?: S3RequestOptions,
  ): Promise<DeleteBucketAnalyticsConfigurationCommandOutput>;
  deleteBucketAnalyticsConfiguration(
    args: DeleteBucketAnalyticsConfigurationCommandInput,
    cb: (err: any, data?: DeleteBucketAnalyticsConfigurationCommandOutput) => void,
  ): void;
  deleteBucketAnalyticsConfiguration(
    args: DeleteBucketAnalyticsConfigurationCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: DeleteBucketAnalyticsConfigurationCommandOutput) => void,
  ): void;
  deleteBucketCors(
    args: DeleteBucketCorsCommandInput,
    options?: S3RequestOptions,
  ): Promise<DeleteBucketCorsCommandOutput>;
  deleteBucketCors(
    args: DeleteBucketCorsCommandInput,
    cb: (err: any, data?: DeleteBucketCorsCommandOutput) => void,
  ): void;
  deleteBucketCors(
    args: DeleteBucketCorsCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: DeleteBucketCorsCommandOutput) => void,
  ): void;
  deleteBucketEncryption(
    args: DeleteBucketEncryptionCommandInput,
    options?: S3RequestOptions,
  ): Promise<DeleteBucketEncryptionCommandOutput>;
  deleteBucketEncryption(
    args: DeleteBucketEncryptionCommandInput,
    cb: (err: any, data?: DeleteBucketEncryptionCommandOutput) => void,
  ): void;
  deleteBucketEncryption(
    args: DeleteBucketEncryptionCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: DeleteBucketEncryptionCommandOutput) => void,
  ): void;
  deleteBucketIntelligentTieringConfiguration(
    args: DeleteBucketIntelligentTieringConfigurationCommandInput,
    options?: S3RequestOptions,
  ): Promise<DeleteBucketIntelligentTieringConfigurationCommandOutput>;
  deleteBucketIntelligentTieringConfiguration(
    args: DeleteBucketIntelligentTieringConfigurationCommandInput,
    cb: (err: any, data?: DeleteBucketIntelligentTieringConfigurationCommandOutput) => void,
  ): void;
  deleteBucketIntelligentTieringConfiguration(
    args: DeleteBucketIntelligentTieringConfigurationCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: DeleteBucketIntelligentTieringConfigurationCommandOutput) => void,
  ): void;
  deleteBucketInventoryConfiguration(
    args: DeleteBucketInventoryConfigurationCommandInput,
    options?: S3RequestOptions,
  ): Promise<DeleteBucketInventoryConfigurationCommandOutput>;
  deleteBucketInventoryConfiguration(
    args: DeleteBucketInventoryConfigurationCommandInput,
    cb: (err: any, data?: DeleteBucketInventoryConfigurationCommandOutput) => void,
  ): void;
  deleteBucketInventoryConfiguration(
    args: DeleteBucketInventoryConfigurationCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: DeleteBucketInventoryConfigurationCommandOutput) => void,
  ): void;
  deleteBucketLifecycle(
    args: DeleteBucketLifecycleCommandInput,
    options?: S3RequestOptions,
  ): Promise<DeleteBucketLifecycleCommandOutput>;
  deleteBucketLifecycle(
    args: DeleteBucketLifecycleCommandInput,
    cb: (err: any, data?: DeleteBucketLifecycleCommandOutput) => void,
  ): void;
  deleteBucketLifecycle(
    args: DeleteBucketLifecycleCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: DeleteBucketLifecycleCommandOutput) => void,
  ): void;
  deleteBucketMetadataConfiguration(
    args: DeleteBucketMetadataConfigurationCommandInput,
    options?: S3RequestOptions,
  ): Promise<DeleteBucketMetadataConfigurationCommandOutput>;
  deleteBucketMetadataConfiguration(
    args: DeleteBucketMetadataConfigurationCommandInput,
    cb: (err: any, data?: DeleteBucketMetadataConfigurationCommandOutput) => void,
  ): void;
  deleteBucketMetadataConfiguration(
    args: DeleteBucketMetadataConfigurationCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: DeleteBucketMetadataConfigurationCommandOutput) => void,
  ): void;
  deleteBucketMetadataTableConfiguration(
    args: DeleteBucketMetadataTableConfigurationCommandInput,
    options?: S3RequestOptions,
  ): Promise<DeleteBucketMetadataTableConfigurationCommandOutput>;
  deleteBucketMetadataTableConfiguration(
    args: DeleteBucketMetadataTableConfigurationCommandInput,
    cb: (err: any, data?: DeleteBucketMetadataTableConfigurationCommandOutput) => void,
  ): void;
  deleteBucketMetadataTableConfiguration(
    args: DeleteBucketMetadataTableConfigurationCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: DeleteBucketMetadataTableConfigurationCommandOutput) => void,
  ): void;
  deleteBucketMetricsConfiguration(
    args: DeleteBucketMetricsConfigurationCommandInput,
    options?: S3RequestOptions,
  ): Promise<DeleteBucketMetricsConfigurationCommandOutput>;
  deleteBucketMetricsConfiguration(
    args: DeleteBucketMetricsConfigurationCommandInput,
    cb: (err: any, data?: DeleteBucketMetricsConfigurationCommandOutput) => void,
  ): void;
  deleteBucketMetricsConfiguration(
    args: DeleteBucketMetricsConfigurationCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: DeleteBucketMetricsConfigurationCommandOutput) => void,
  ): void;
  deleteBucketOwnershipControls(
    args: DeleteBucketOwnershipControlsCommandInput,
    options?: S3RequestOptions,
  ): Promise<DeleteBucketOwnershipControlsCommandOutput>;
  deleteBucketOwnershipControls(
    args: DeleteBucketOwnershipControlsCommandInput,
    cb: (err: any, data?: DeleteBucketOwnershipControlsCommandOutput) => void,
  ): void;
  deleteBucketOwnershipControls(
    args: DeleteBucketOwnershipControlsCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: DeleteBucketOwnershipControlsCommandOutput) => void,
  ): void;
  deleteBucketPolicy(
    args: DeleteBucketPolicyCommandInput,
    options?: S3RequestOptions,
  ): Promise<DeleteBucketPolicyCommandOutput>;
  deleteBucketPolicy(
    args: DeleteBucketPolicyCommandInput,
    cb: (err: any, data?: DeleteBucketPolicyCommandOutput) => void,
  ): void;
  deleteBucketPolicy(
    args: DeleteBucketPolicyCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: DeleteBucketPolicyCommandOutput) => void,
  ): void;
  deleteBucketReplication(
    args: DeleteBucketReplicationCommandInput,
    options?: S3RequestOptions,
  ): Promise<DeleteBucketReplicationCommandOutput>;
  deleteBucketReplication(
    args: DeleteBucketReplicationCommandInput,
    cb: (err: any, data?: DeleteBucketReplicationCommandOutput) => void,
  ): void;
  deleteBucketReplication(
    args: DeleteBucketReplicationCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: DeleteBucketReplicationCommandOutput) => void,
  ): void;
  deleteBucketTagging(
    args: DeleteBucketTaggingCommandInput,
    options?: S3RequestOptions,
  ): Promise<DeleteBucketTaggingCommandOutput>;
  deleteBucketTagging(
    args: DeleteBucketTaggingCommandInput,
    cb: (err: any, data?: DeleteBucketTaggingCommandOutput) => void,
  ): void;
  deleteBucketTagging(
    args: DeleteBucketTaggingCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: DeleteBucketTaggingCommandOutput) => void,
  ): void;
  deleteBucketWebsite(
    args: DeleteBucketWebsiteCommandInput,
    options?: S3RequestOptions,
  ): Promise<DeleteBucketWebsiteCommandOutput>;
  deleteBucketWebsite(
    args: DeleteBucketWebsiteCommandInput,
    cb: (err: any, data?: DeleteBucketWebsiteCommandOutput) => void,
  ): void;
  deleteBucketWebsite(
    args: DeleteBucketWebsiteCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: DeleteBucketWebsiteCommandOutput) => void,
  ): void;
  deleteObject(
    args: DeleteObjectCommandInput,
    options?: S3RequestOptions,
  ): Promise<DeleteObjectCommandOutput>;
  deleteObject(
    args: DeleteObjectCommandInput,
    cb: (err: any, data?: DeleteObjectCommandOutput) => void,
  ): void;
  deleteObject(
    args: DeleteObjectCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: DeleteObjectCommandOutput) => void,
  ): void;
  deleteObjectAnnotation(
    args: DeleteObjectAnnotationCommandInput,
    options?: S3RequestOptions,
  ): Promise<DeleteObjectAnnotationCommandOutput>;
  deleteObjectAnnotation(
    args: DeleteObjectAnnotationCommandInput,
    cb: (err: any, data?: DeleteObjectAnnotationCommandOutput) => void,
  ): void;
  deleteObjectAnnotation(
    args: DeleteObjectAnnotationCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: DeleteObjectAnnotationCommandOutput) => void,
  ): void;
  deleteObjects(
    args: DeleteObjectsCommandInput,
    options?: S3RequestOptions,
  ): Promise<DeleteObjectsCommandOutput>;
  deleteObjects(
    args: DeleteObjectsCommandInput,
    cb: (err: any, data?: DeleteObjectsCommandOutput) => void,
  ): void;
  deleteObjects(
    args: DeleteObjectsCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: DeleteObjectsCommandOutput) => void,
  ): void;
  deleteObjectTagging(
    args: DeleteObjectTaggingCommandInput,
    options?: S3RequestOptions,
  ): Promise<DeleteObjectTaggingCommandOutput>;
  deleteObjectTagging(
    args: DeleteObjectTaggingCommandInput,
    cb: (err: any, data?: DeleteObjectTaggingCommandOutput) => void,
  ): void;
  deleteObjectTagging(
    args: DeleteObjectTaggingCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: DeleteObjectTaggingCommandOutput) => void,
  ): void;
  deletePublicAccessBlock(
    args: DeletePublicAccessBlockCommandInput,
    options?: S3RequestOptions,
  ): Promise<DeletePublicAccessBlockCommandOutput>;
  deletePublicAccessBlock(
    args: DeletePublicAccessBlockCommandInput,
    cb: (err: any, data?: DeletePublicAccessBlockCommandOutput) => void,
  ): void;
  deletePublicAccessBlock(
    args: DeletePublicAccessBlockCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: DeletePublicAccessBlockCommandOutput) => void,
  ): void;
  getBucketAbac(
    args: GetBucketAbacCommandInput,
    options?: S3RequestOptions,
  ): Promise<GetBucketAbacCommandOutput>;
  getBucketAbac(
    args: GetBucketAbacCommandInput,
    cb: (err: any, data?: GetBucketAbacCommandOutput) => void,
  ): void;
  getBucketAbac(
    args: GetBucketAbacCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: GetBucketAbacCommandOutput) => void,
  ): void;
  getBucketAccelerateConfiguration(
    args: GetBucketAccelerateConfigurationCommandInput,
    options?: S3RequestOptions,
  ): Promise<GetBucketAccelerateConfigurationCommandOutput>;
  getBucketAccelerateConfiguration(
    args: GetBucketAccelerateConfigurationCommandInput,
    cb: (err: any, data?: GetBucketAccelerateConfigurationCommandOutput) => void,
  ): void;
  getBucketAccelerateConfiguration(
    args: GetBucketAccelerateConfigurationCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: GetBucketAccelerateConfigurationCommandOutput) => void,
  ): void;
  getBucketAcl(
    args: GetBucketAclCommandInput,
    options?: S3RequestOptions,
  ): Promise<GetBucketAclCommandOutput>;
  getBucketAcl(
    args: GetBucketAclCommandInput,
    cb: (err: any, data?: GetBucketAclCommandOutput) => void,
  ): void;
  getBucketAcl(
    args: GetBucketAclCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: GetBucketAclCommandOutput) => void,
  ): void;
  getBucketAnalyticsConfiguration(
    args: GetBucketAnalyticsConfigurationCommandInput,
    options?: S3RequestOptions,
  ): Promise<GetBucketAnalyticsConfigurationCommandOutput>;
  getBucketAnalyticsConfiguration(
    args: GetBucketAnalyticsConfigurationCommandInput,
    cb: (err: any, data?: GetBucketAnalyticsConfigurationCommandOutput) => void,
  ): void;
  getBucketAnalyticsConfiguration(
    args: GetBucketAnalyticsConfigurationCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: GetBucketAnalyticsConfigurationCommandOutput) => void,
  ): void;
  getBucketCors(
    args: GetBucketCorsCommandInput,
    options?: S3RequestOptions,
  ): Promise<GetBucketCorsCommandOutput>;
  getBucketCors(
    args: GetBucketCorsCommandInput,
    cb: (err: any, data?: GetBucketCorsCommandOutput) => void,
  ): void;
  getBucketCors(
    args: GetBucketCorsCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: GetBucketCorsCommandOutput) => void,
  ): void;
  getBucketEncryption(
    args: GetBucketEncryptionCommandInput,
    options?: S3RequestOptions,
  ): Promise<GetBucketEncryptionCommandOutput>;
  getBucketEncryption(
    args: GetBucketEncryptionCommandInput,
    cb: (err: any, data?: GetBucketEncryptionCommandOutput) => void,
  ): void;
  getBucketEncryption(
    args: GetBucketEncryptionCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: GetBucketEncryptionCommandOutput) => void,
  ): void;
  getBucketIntelligentTieringConfiguration(
    args: GetBucketIntelligentTieringConfigurationCommandInput,
    options?: S3RequestOptions,
  ): Promise<GetBucketIntelligentTieringConfigurationCommandOutput>;
  getBucketIntelligentTieringConfiguration(
    args: GetBucketIntelligentTieringConfigurationCommandInput,
    cb: (err: any, data?: GetBucketIntelligentTieringConfigurationCommandOutput) => void,
  ): void;
  getBucketIntelligentTieringConfiguration(
    args: GetBucketIntelligentTieringConfigurationCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: GetBucketIntelligentTieringConfigurationCommandOutput) => void,
  ): void;
  getBucketInventoryConfiguration(
    args: GetBucketInventoryConfigurationCommandInput,
    options?: S3RequestOptions,
  ): Promise<GetBucketInventoryConfigurationCommandOutput>;
  getBucketInventoryConfiguration(
    args: GetBucketInventoryConfigurationCommandInput,
    cb: (err: any, data?: GetBucketInventoryConfigurationCommandOutput) => void,
  ): void;
  getBucketInventoryConfiguration(
    args: GetBucketInventoryConfigurationCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: GetBucketInventoryConfigurationCommandOutput) => void,
  ): void;
  getBucketLifecycleConfiguration(
    args: GetBucketLifecycleConfigurationCommandInput,
    options?: S3RequestOptions,
  ): Promise<GetBucketLifecycleConfigurationCommandOutput>;
  getBucketLifecycleConfiguration(
    args: GetBucketLifecycleConfigurationCommandInput,
    cb: (err: any, data?: GetBucketLifecycleConfigurationCommandOutput) => void,
  ): void;
  getBucketLifecycleConfiguration(
    args: GetBucketLifecycleConfigurationCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: GetBucketLifecycleConfigurationCommandOutput) => void,
  ): void;
  getBucketLocation(
    args: GetBucketLocationCommandInput,
    options?: S3RequestOptions,
  ): Promise<GetBucketLocationCommandOutput>;
  getBucketLocation(
    args: GetBucketLocationCommandInput,
    cb: (err: any, data?: GetBucketLocationCommandOutput) => void,
  ): void;
  getBucketLocation(
    args: GetBucketLocationCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: GetBucketLocationCommandOutput) => void,
  ): void;
  getBucketLogging(
    args: GetBucketLoggingCommandInput,
    options?: S3RequestOptions,
  ): Promise<GetBucketLoggingCommandOutput>;
  getBucketLogging(
    args: GetBucketLoggingCommandInput,
    cb: (err: any, data?: GetBucketLoggingCommandOutput) => void,
  ): void;
  getBucketLogging(
    args: GetBucketLoggingCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: GetBucketLoggingCommandOutput) => void,
  ): void;
  getBucketMetadataConfiguration(
    args: GetBucketMetadataConfigurationCommandInput,
    options?: S3RequestOptions,
  ): Promise<GetBucketMetadataConfigurationCommandOutput>;
  getBucketMetadataConfiguration(
    args: GetBucketMetadataConfigurationCommandInput,
    cb: (err: any, data?: GetBucketMetadataConfigurationCommandOutput) => void,
  ): void;
  getBucketMetadataConfiguration(
    args: GetBucketMetadataConfigurationCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: GetBucketMetadataConfigurationCommandOutput) => void,
  ): void;
  getBucketMetadataTableConfiguration(
    args: GetBucketMetadataTableConfigurationCommandInput,
    options?: S3RequestOptions,
  ): Promise<GetBucketMetadataTableConfigurationCommandOutput>;
  getBucketMetadataTableConfiguration(
    args: GetBucketMetadataTableConfigurationCommandInput,
    cb: (err: any, data?: GetBucketMetadataTableConfigurationCommandOutput) => void,
  ): void;
  getBucketMetadataTableConfiguration(
    args: GetBucketMetadataTableConfigurationCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: GetBucketMetadataTableConfigurationCommandOutput) => void,
  ): void;
  getBucketMetricsConfiguration(
    args: GetBucketMetricsConfigurationCommandInput,
    options?: S3RequestOptions,
  ): Promise<GetBucketMetricsConfigurationCommandOutput>;
  getBucketMetricsConfiguration(
    args: GetBucketMetricsConfigurationCommandInput,
    cb: (err: any, data?: GetBucketMetricsConfigurationCommandOutput) => void,
  ): void;
  getBucketMetricsConfiguration(
    args: GetBucketMetricsConfigurationCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: GetBucketMetricsConfigurationCommandOutput) => void,
  ): void;
  getBucketNotificationConfiguration(
    args: GetBucketNotificationConfigurationCommandInput,
    options?: S3RequestOptions,
  ): Promise<GetBucketNotificationConfigurationCommandOutput>;
  getBucketNotificationConfiguration(
    args: GetBucketNotificationConfigurationCommandInput,
    cb: (err: any, data?: GetBucketNotificationConfigurationCommandOutput) => void,
  ): void;
  getBucketNotificationConfiguration(
    args: GetBucketNotificationConfigurationCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: GetBucketNotificationConfigurationCommandOutput) => void,
  ): void;
  getBucketOwnershipControls(
    args: GetBucketOwnershipControlsCommandInput,
    options?: S3RequestOptions,
  ): Promise<GetBucketOwnershipControlsCommandOutput>;
  getBucketOwnershipControls(
    args: GetBucketOwnershipControlsCommandInput,
    cb: (err: any, data?: GetBucketOwnershipControlsCommandOutput) => void,
  ): void;
  getBucketOwnershipControls(
    args: GetBucketOwnershipControlsCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: GetBucketOwnershipControlsCommandOutput) => void,
  ): void;
  getBucketPolicy(
    args: GetBucketPolicyCommandInput,
    options?: S3RequestOptions,
  ): Promise<GetBucketPolicyCommandOutput>;
  getBucketPolicy(
    args: GetBucketPolicyCommandInput,
    cb: (err: any, data?: GetBucketPolicyCommandOutput) => void,
  ): void;
  getBucketPolicy(
    args: GetBucketPolicyCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: GetBucketPolicyCommandOutput) => void,
  ): void;
  getBucketPolicyStatus(
    args: GetBucketPolicyStatusCommandInput,
    options?: S3RequestOptions,
  ): Promise<GetBucketPolicyStatusCommandOutput>;
  getBucketPolicyStatus(
    args: GetBucketPolicyStatusCommandInput,
    cb: (err: any, data?: GetBucketPolicyStatusCommandOutput) => void,
  ): void;
  getBucketPolicyStatus(
    args: GetBucketPolicyStatusCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: GetBucketPolicyStatusCommandOutput) => void,
  ): void;
  getBucketReplication(
    args: GetBucketReplicationCommandInput,
    options?: S3RequestOptions,
  ): Promise<GetBucketReplicationCommandOutput>;
  getBucketReplication(
    args: GetBucketReplicationCommandInput,
    cb: (err: any, data?: GetBucketReplicationCommandOutput) => void,
  ): void;
  getBucketReplication(
    args: GetBucketReplicationCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: GetBucketReplicationCommandOutput) => void,
  ): void;
  getBucketRequestPayment(
    args: GetBucketRequestPaymentCommandInput,
    options?: S3RequestOptions,
  ): Promise<GetBucketRequestPaymentCommandOutput>;
  getBucketRequestPayment(
    args: GetBucketRequestPaymentCommandInput,
    cb: (err: any, data?: GetBucketRequestPaymentCommandOutput) => void,
  ): void;
  getBucketRequestPayment(
    args: GetBucketRequestPaymentCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: GetBucketRequestPaymentCommandOutput) => void,
  ): void;
  getBucketTagging(
    args: GetBucketTaggingCommandInput,
    options?: S3RequestOptions,
  ): Promise<GetBucketTaggingCommandOutput>;
  getBucketTagging(
    args: GetBucketTaggingCommandInput,
    cb: (err: any, data?: GetBucketTaggingCommandOutput) => void,
  ): void;
  getBucketTagging(
    args: GetBucketTaggingCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: GetBucketTaggingCommandOutput) => void,
  ): void;
  getBucketVersioning(
    args: GetBucketVersioningCommandInput,
    options?: S3RequestOptions,
  ): Promise<GetBucketVersioningCommandOutput>;
  getBucketVersioning(
    args: GetBucketVersioningCommandInput,
    cb: (err: any, data?: GetBucketVersioningCommandOutput) => void,
  ): void;
  getBucketVersioning(
    args: GetBucketVersioningCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: GetBucketVersioningCommandOutput) => void,
  ): void;
  getBucketWebsite(
    args: GetBucketWebsiteCommandInput,
    options?: S3RequestOptions,
  ): Promise<GetBucketWebsiteCommandOutput>;
  getBucketWebsite(
    args: GetBucketWebsiteCommandInput,
    cb: (err: any, data?: GetBucketWebsiteCommandOutput) => void,
  ): void;
  getBucketWebsite(
    args: GetBucketWebsiteCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: GetBucketWebsiteCommandOutput) => void,
  ): void;
  getObject(
    args: GetObjectCommandInput,
    options?: S3RequestOptions,
  ): Promise<GetObjectCommandOutput>;
  getObject(
    args: GetObjectCommandInput,
    cb: (err: any, data?: GetObjectCommandOutput) => void,
  ): void;
  getObject(
    args: GetObjectCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: GetObjectCommandOutput) => void,
  ): void;
  getObjectAcl(
    args: GetObjectAclCommandInput,
    options?: S3RequestOptions,
  ): Promise<GetObjectAclCommandOutput>;
  getObjectAcl(
    args: GetObjectAclCommandInput,
    cb: (err: any, data?: GetObjectAclCommandOutput) => void,
  ): void;
  getObjectAcl(
    args: GetObjectAclCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: GetObjectAclCommandOutput) => void,
  ): void;
  getObjectAnnotation(
    args: GetObjectAnnotationCommandInput,
    options?: S3RequestOptions,
  ): Promise<GetObjectAnnotationCommandOutput>;
  getObjectAnnotation(
    args: GetObjectAnnotationCommandInput,
    cb: (err: any, data?: GetObjectAnnotationCommandOutput) => void,
  ): void;
  getObjectAnnotation(
    args: GetObjectAnnotationCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: GetObjectAnnotationCommandOutput) => void,
  ): void;
  getObjectAttributes(
    args: GetObjectAttributesCommandInput,
    options?: S3RequestOptions,
  ): Promise<GetObjectAttributesCommandOutput>;
  getObjectAttributes(
    args: GetObjectAttributesCommandInput,
    cb: (err: any, data?: GetObjectAttributesCommandOutput) => void,
  ): void;
  getObjectAttributes(
    args: GetObjectAttributesCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: GetObjectAttributesCommandOutput) => void,
  ): void;
  getObjectLegalHold(
    args: GetObjectLegalHoldCommandInput,
    options?: S3RequestOptions,
  ): Promise<GetObjectLegalHoldCommandOutput>;
  getObjectLegalHold(
    args: GetObjectLegalHoldCommandInput,
    cb: (err: any, data?: GetObjectLegalHoldCommandOutput) => void,
  ): void;
  getObjectLegalHold(
    args: GetObjectLegalHoldCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: GetObjectLegalHoldCommandOutput) => void,
  ): void;
  getObjectLockConfiguration(
    args: GetObjectLockConfigurationCommandInput,
    options?: S3RequestOptions,
  ): Promise<GetObjectLockConfigurationCommandOutput>;
  getObjectLockConfiguration(
    args: GetObjectLockConfigurationCommandInput,
    cb: (err: any, data?: GetObjectLockConfigurationCommandOutput) => void,
  ): void;
  getObjectLockConfiguration(
    args: GetObjectLockConfigurationCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: GetObjectLockConfigurationCommandOutput) => void,
  ): void;
  getObjectRetention(
    args: GetObjectRetentionCommandInput,
    options?: S3RequestOptions,
  ): Promise<GetObjectRetentionCommandOutput>;
  getObjectRetention(
    args: GetObjectRetentionCommandInput,
    cb: (err: any, data?: GetObjectRetentionCommandOutput) => void,
  ): void;
  getObjectRetention(
    args: GetObjectRetentionCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: GetObjectRetentionCommandOutput) => void,
  ): void;
  getObjectTagging(
    args: GetObjectTaggingCommandInput,
    options?: S3RequestOptions,
  ): Promise<GetObjectTaggingCommandOutput>;
  getObjectTagging(
    args: GetObjectTaggingCommandInput,
    cb: (err: any, data?: GetObjectTaggingCommandOutput) => void,
  ): void;
  getObjectTagging(
    args: GetObjectTaggingCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: GetObjectTaggingCommandOutput) => void,
  ): void;
  getObjectTorrent(
    args: GetObjectTorrentCommandInput,
    options?: S3RequestOptions,
  ): Promise<GetObjectTorrentCommandOutput>;
  getObjectTorrent(
    args: GetObjectTorrentCommandInput,
    cb: (err: any, data?: GetObjectTorrentCommandOutput) => void,
  ): void;
  getObjectTorrent(
    args: GetObjectTorrentCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: GetObjectTorrentCommandOutput) => void,
  ): void;
  getPublicAccessBlock(
    args: GetPublicAccessBlockCommandInput,
    options?: S3RequestOptions,
  ): Promise<GetPublicAccessBlockCommandOutput>;
  getPublicAccessBlock(
    args: GetPublicAccessBlockCommandInput,
    cb: (err: any, data?: GetPublicAccessBlockCommandOutput) => void,
  ): void;
  getPublicAccessBlock(
    args: GetPublicAccessBlockCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: GetPublicAccessBlockCommandOutput) => void,
  ): void;
  headBucket(
    args: HeadBucketCommandInput,
    options?: S3RequestOptions,
  ): Promise<HeadBucketCommandOutput>;
  headBucket(
    args: HeadBucketCommandInput,
    cb: (err: any, data?: HeadBucketCommandOutput) => void,
  ): void;
  headBucket(
    args: HeadBucketCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: HeadBucketCommandOutput) => void,
  ): void;
  headObject(
    args: HeadObjectCommandInput,
    options?: S3RequestOptions,
  ): Promise<HeadObjectCommandOutput>;
  headObject(
    args: HeadObjectCommandInput,
    cb: (err: any, data?: HeadObjectCommandOutput) => void,
  ): void;
  headObject(
    args: HeadObjectCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: HeadObjectCommandOutput) => void,
  ): void;
  listBucketAnalyticsConfigurations(
    args: ListBucketAnalyticsConfigurationsCommandInput,
    options?: S3RequestOptions,
  ): Promise<ListBucketAnalyticsConfigurationsCommandOutput>;
  listBucketAnalyticsConfigurations(
    args: ListBucketAnalyticsConfigurationsCommandInput,
    cb: (err: any, data?: ListBucketAnalyticsConfigurationsCommandOutput) => void,
  ): void;
  listBucketAnalyticsConfigurations(
    args: ListBucketAnalyticsConfigurationsCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: ListBucketAnalyticsConfigurationsCommandOutput) => void,
  ): void;
  listBucketIntelligentTieringConfigurations(
    args: ListBucketIntelligentTieringConfigurationsCommandInput,
    options?: S3RequestOptions,
  ): Promise<ListBucketIntelligentTieringConfigurationsCommandOutput>;
  listBucketIntelligentTieringConfigurations(
    args: ListBucketIntelligentTieringConfigurationsCommandInput,
    cb: (err: any, data?: ListBucketIntelligentTieringConfigurationsCommandOutput) => void,
  ): void;
  listBucketIntelligentTieringConfigurations(
    args: ListBucketIntelligentTieringConfigurationsCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: ListBucketIntelligentTieringConfigurationsCommandOutput) => void,
  ): void;
  listBucketInventoryConfigurations(
    args: ListBucketInventoryConfigurationsCommandInput,
    options?: S3RequestOptions,
  ): Promise<ListBucketInventoryConfigurationsCommandOutput>;
  listBucketInventoryConfigurations(
    args: ListBucketInventoryConfigurationsCommandInput,
    cb: (err: any, data?: ListBucketInventoryConfigurationsCommandOutput) => void,
  ): void;
  listBucketInventoryConfigurations(
    args: ListBucketInventoryConfigurationsCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: ListBucketInventoryConfigurationsCommandOutput) => void,
  ): void;
  listBucketMetricsConfigurations(
    args: ListBucketMetricsConfigurationsCommandInput,
    options?: S3RequestOptions,
  ): Promise<ListBucketMetricsConfigurationsCommandOutput>;
  listBucketMetricsConfigurations(
    args: ListBucketMetricsConfigurationsCommandInput,
    cb: (err: any, data?: ListBucketMetricsConfigurationsCommandOutput) => void,
  ): void;
  listBucketMetricsConfigurations(
    args: ListBucketMetricsConfigurationsCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: ListBucketMetricsConfigurationsCommandOutput) => void,
  ): void;
  listBuckets(): Promise<ListBucketsCommandOutput>;
  listBuckets(
    args: ListBucketsCommandInput,
    options?: S3RequestOptions,
  ): Promise<ListBucketsCommandOutput>;
  listBuckets(
    args: ListBucketsCommandInput,
    cb: (err: any, data?: ListBucketsCommandOutput) => void,
  ): void;
  listBuckets(
    args: ListBucketsCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: ListBucketsCommandOutput) => void,
  ): void;
  listDirectoryBuckets(): Promise<ListDirectoryBucketsCommandOutput>;
  listDirectoryBuckets(
    args: ListDirectoryBucketsCommandInput,
    options?: S3RequestOptions,
  ): Promise<ListDirectoryBucketsCommandOutput>;
  listDirectoryBuckets(
    args: ListDirectoryBucketsCommandInput,
    cb: (err: any, data?: ListDirectoryBucketsCommandOutput) => void,
  ): void;
  listDirectoryBuckets(
    args: ListDirectoryBucketsCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: ListDirectoryBucketsCommandOutput) => void,
  ): void;
  listMultipartUploads(
    args: ListMultipartUploadsCommandInput,
    options?: S3RequestOptions,
  ): Promise<ListMultipartUploadsCommandOutput>;
  listMultipartUploads(
    args: ListMultipartUploadsCommandInput,
    cb: (err: any, data?: ListMultipartUploadsCommandOutput) => void,
  ): void;
  listMultipartUploads(
    args: ListMultipartUploadsCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: ListMultipartUploadsCommandOutput) => void,
  ): void;
  listObjectAnnotations(
    args: ListObjectAnnotationsCommandInput,
    options?: S3RequestOptions,
  ): Promise<ListObjectAnnotationsCommandOutput>;
  listObjectAnnotations(
    args: ListObjectAnnotationsCommandInput,
    cb: (err: any, data?: ListObjectAnnotationsCommandOutput) => void,
  ): void;
  listObjectAnnotations(
    args: ListObjectAnnotationsCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: ListObjectAnnotationsCommandOutput) => void,
  ): void;
  listObjects(
    args: ListObjectsCommandInput,
    options?: S3RequestOptions,
  ): Promise<ListObjectsCommandOutput>;
  listObjects(
    args: ListObjectsCommandInput,
    cb: (err: any, data?: ListObjectsCommandOutput) => void,
  ): void;
  listObjects(
    args: ListObjectsCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: ListObjectsCommandOutput) => void,
  ): void;
  listObjectsV2(
    args: ListObjectsV2CommandInput,
    options?: S3RequestOptions,
  ): Promise<ListObjectsV2CommandOutput>;
  listObjectsV2(
    args: ListObjectsV2CommandInput,
    cb: (err: any, data?: ListObjectsV2CommandOutput) => void,
  ): void;
  listObjectsV2(
    args: ListObjectsV2CommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: ListObjectsV2CommandOutput) => void,
  ): void;
  listObjectVersions(
    args: ListObjectVersionsCommandInput,
    options?: S3RequestOptions,
  ): Promise<ListObjectVersionsCommandOutput>;
  listObjectVersions(
    args: ListObjectVersionsCommandInput,
    cb: (err: any, data?: ListObjectVersionsCommandOutput) => void,
  ): void;
  listObjectVersions(
    args: ListObjectVersionsCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: ListObjectVersionsCommandOutput) => void,
  ): void;
  listParts(
    args: ListPartsCommandInput,
    options?: S3RequestOptions,
  ): Promise<ListPartsCommandOutput>;
  listParts(
    args: ListPartsCommandInput,
    cb: (err: any, data?: ListPartsCommandOutput) => void,
  ): void;
  listParts(
    args: ListPartsCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: ListPartsCommandOutput) => void,
  ): void;
  putBucketAbac(
    args: PutBucketAbacCommandInput,
    options?: S3RequestOptions,
  ): Promise<PutBucketAbacCommandOutput>;
  putBucketAbac(
    args: PutBucketAbacCommandInput,
    cb: (err: any, data?: PutBucketAbacCommandOutput) => void,
  ): void;
  putBucketAbac(
    args: PutBucketAbacCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: PutBucketAbacCommandOutput) => void,
  ): void;
  putBucketAccelerateConfiguration(
    args: PutBucketAccelerateConfigurationCommandInput,
    options?: S3RequestOptions,
  ): Promise<PutBucketAccelerateConfigurationCommandOutput>;
  putBucketAccelerateConfiguration(
    args: PutBucketAccelerateConfigurationCommandInput,
    cb: (err: any, data?: PutBucketAccelerateConfigurationCommandOutput) => void,
  ): void;
  putBucketAccelerateConfiguration(
    args: PutBucketAccelerateConfigurationCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: PutBucketAccelerateConfigurationCommandOutput) => void,
  ): void;
  putBucketAcl(
    args: PutBucketAclCommandInput,
    options?: S3RequestOptions,
  ): Promise<PutBucketAclCommandOutput>;
  putBucketAcl(
    args: PutBucketAclCommandInput,
    cb: (err: any, data?: PutBucketAclCommandOutput) => void,
  ): void;
  putBucketAcl(
    args: PutBucketAclCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: PutBucketAclCommandOutput) => void,
  ): void;
  putBucketAnalyticsConfiguration(
    args: PutBucketAnalyticsConfigurationCommandInput,
    options?: S3RequestOptions,
  ): Promise<PutBucketAnalyticsConfigurationCommandOutput>;
  putBucketAnalyticsConfiguration(
    args: PutBucketAnalyticsConfigurationCommandInput,
    cb: (err: any, data?: PutBucketAnalyticsConfigurationCommandOutput) => void,
  ): void;
  putBucketAnalyticsConfiguration(
    args: PutBucketAnalyticsConfigurationCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: PutBucketAnalyticsConfigurationCommandOutput) => void,
  ): void;
  putBucketCors(
    args: PutBucketCorsCommandInput,
    options?: S3RequestOptions,
  ): Promise<PutBucketCorsCommandOutput>;
  putBucketCors(
    args: PutBucketCorsCommandInput,
    cb: (err: any, data?: PutBucketCorsCommandOutput) => void,
  ): void;
  putBucketCors(
    args: PutBucketCorsCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: PutBucketCorsCommandOutput) => void,
  ): void;
  putBucketEncryption(
    args: PutBucketEncryptionCommandInput,
    options?: S3RequestOptions,
  ): Promise<PutBucketEncryptionCommandOutput>;
  putBucketEncryption(
    args: PutBucketEncryptionCommandInput,
    cb: (err: any, data?: PutBucketEncryptionCommandOutput) => void,
  ): void;
  putBucketEncryption(
    args: PutBucketEncryptionCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: PutBucketEncryptionCommandOutput) => void,
  ): void;
  putBucketIntelligentTieringConfiguration(
    args: PutBucketIntelligentTieringConfigurationCommandInput,
    options?: S3RequestOptions,
  ): Promise<PutBucketIntelligentTieringConfigurationCommandOutput>;
  putBucketIntelligentTieringConfiguration(
    args: PutBucketIntelligentTieringConfigurationCommandInput,
    cb: (err: any, data?: PutBucketIntelligentTieringConfigurationCommandOutput) => void,
  ): void;
  putBucketIntelligentTieringConfiguration(
    args: PutBucketIntelligentTieringConfigurationCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: PutBucketIntelligentTieringConfigurationCommandOutput) => void,
  ): void;
  putBucketInventoryConfiguration(
    args: PutBucketInventoryConfigurationCommandInput,
    options?: S3RequestOptions,
  ): Promise<PutBucketInventoryConfigurationCommandOutput>;
  putBucketInventoryConfiguration(
    args: PutBucketInventoryConfigurationCommandInput,
    cb: (err: any, data?: PutBucketInventoryConfigurationCommandOutput) => void,
  ): void;
  putBucketInventoryConfiguration(
    args: PutBucketInventoryConfigurationCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: PutBucketInventoryConfigurationCommandOutput) => void,
  ): void;
  putBucketLifecycleConfiguration(
    args: PutBucketLifecycleConfigurationCommandInput,
    options?: S3RequestOptions,
  ): Promise<PutBucketLifecycleConfigurationCommandOutput>;
  putBucketLifecycleConfiguration(
    args: PutBucketLifecycleConfigurationCommandInput,
    cb: (err: any, data?: PutBucketLifecycleConfigurationCommandOutput) => void,
  ): void;
  putBucketLifecycleConfiguration(
    args: PutBucketLifecycleConfigurationCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: PutBucketLifecycleConfigurationCommandOutput) => void,
  ): void;
  putBucketLogging(
    args: PutBucketLoggingCommandInput,
    options?: S3RequestOptions,
  ): Promise<PutBucketLoggingCommandOutput>;
  putBucketLogging(
    args: PutBucketLoggingCommandInput,
    cb: (err: any, data?: PutBucketLoggingCommandOutput) => void,
  ): void;
  putBucketLogging(
    args: PutBucketLoggingCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: PutBucketLoggingCommandOutput) => void,
  ): void;
  putBucketMetricsConfiguration(
    args: PutBucketMetricsConfigurationCommandInput,
    options?: S3RequestOptions,
  ): Promise<PutBucketMetricsConfigurationCommandOutput>;
  putBucketMetricsConfiguration(
    args: PutBucketMetricsConfigurationCommandInput,
    cb: (err: any, data?: PutBucketMetricsConfigurationCommandOutput) => void,
  ): void;
  putBucketMetricsConfiguration(
    args: PutBucketMetricsConfigurationCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: PutBucketMetricsConfigurationCommandOutput) => void,
  ): void;
  putBucketNotificationConfiguration(
    args: PutBucketNotificationConfigurationCommandInput,
    options?: S3RequestOptions,
  ): Promise<PutBucketNotificationConfigurationCommandOutput>;
  putBucketNotificationConfiguration(
    args: PutBucketNotificationConfigurationCommandInput,
    cb: (err: any, data?: PutBucketNotificationConfigurationCommandOutput) => void,
  ): void;
  putBucketNotificationConfiguration(
    args: PutBucketNotificationConfigurationCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: PutBucketNotificationConfigurationCommandOutput) => void,
  ): void;
  putBucketOwnershipControls(
    args: PutBucketOwnershipControlsCommandInput,
    options?: S3RequestOptions,
  ): Promise<PutBucketOwnershipControlsCommandOutput>;
  putBucketOwnershipControls(
    args: PutBucketOwnershipControlsCommandInput,
    cb: (err: any, data?: PutBucketOwnershipControlsCommandOutput) => void,
  ): void;
  putBucketOwnershipControls(
    args: PutBucketOwnershipControlsCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: PutBucketOwnershipControlsCommandOutput) => void,
  ): void;
  putBucketPolicy(
    args: PutBucketPolicyCommandInput,
    options?: S3RequestOptions,
  ): Promise<PutBucketPolicyCommandOutput>;
  putBucketPolicy(
    args: PutBucketPolicyCommandInput,
    cb: (err: any, data?: PutBucketPolicyCommandOutput) => void,
  ): void;
  putBucketPolicy(
    args: PutBucketPolicyCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: PutBucketPolicyCommandOutput) => void,
  ): void;
  putBucketReplication(
    args: PutBucketReplicationCommandInput,
    options?: S3RequestOptions,
  ): Promise<PutBucketReplicationCommandOutput>;
  putBucketReplication(
    args: PutBucketReplicationCommandInput,
    cb: (err: any, data?: PutBucketReplicationCommandOutput) => void,
  ): void;
  putBucketReplication(
    args: PutBucketReplicationCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: PutBucketReplicationCommandOutput) => void,
  ): void;
  putBucketRequestPayment(
    args: PutBucketRequestPaymentCommandInput,
    options?: S3RequestOptions,
  ): Promise<PutBucketRequestPaymentCommandOutput>;
  putBucketRequestPayment(
    args: PutBucketRequestPaymentCommandInput,
    cb: (err: any, data?: PutBucketRequestPaymentCommandOutput) => void,
  ): void;
  putBucketRequestPayment(
    args: PutBucketRequestPaymentCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: PutBucketRequestPaymentCommandOutput) => void,
  ): void;
  putBucketTagging(
    args: PutBucketTaggingCommandInput,
    options?: S3RequestOptions,
  ): Promise<PutBucketTaggingCommandOutput>;
  putBucketTagging(
    args: PutBucketTaggingCommandInput,
    cb: (err: any, data?: PutBucketTaggingCommandOutput) => void,
  ): void;
  putBucketTagging(
    args: PutBucketTaggingCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: PutBucketTaggingCommandOutput) => void,
  ): void;
  putBucketVersioning(
    args: PutBucketVersioningCommandInput,
    options?: S3RequestOptions,
  ): Promise<PutBucketVersioningCommandOutput>;
  putBucketVersioning(
    args: PutBucketVersioningCommandInput,
    cb: (err: any, data?: PutBucketVersioningCommandOutput) => void,
  ): void;
  putBucketVersioning(
    args: PutBucketVersioningCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: PutBucketVersioningCommandOutput) => void,
  ): void;
  putBucketWebsite(
    args: PutBucketWebsiteCommandInput,
    options?: S3RequestOptions,
  ): Promise<PutBucketWebsiteCommandOutput>;
  putBucketWebsite(
    args: PutBucketWebsiteCommandInput,
    cb: (err: any, data?: PutBucketWebsiteCommandOutput) => void,
  ): void;
  putBucketWebsite(
    args: PutBucketWebsiteCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: PutBucketWebsiteCommandOutput) => void,
  ): void;
  putObject(
    args: PutObjectCommandInput,
    options?: S3RequestOptions,
  ): Promise<PutObjectCommandOutput>;
  putObject(
    args: PutObjectCommandInput,
    cb: (err: any, data?: PutObjectCommandOutput) => void,
  ): void;
  putObject(
    args: PutObjectCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: PutObjectCommandOutput) => void,
  ): void;
  putObjectAcl(
    args: PutObjectAclCommandInput,
    options?: S3RequestOptions,
  ): Promise<PutObjectAclCommandOutput>;
  putObjectAcl(
    args: PutObjectAclCommandInput,
    cb: (err: any, data?: PutObjectAclCommandOutput) => void,
  ): void;
  putObjectAcl(
    args: PutObjectAclCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: PutObjectAclCommandOutput) => void,
  ): void;
  putObjectAnnotation(
    args: PutObjectAnnotationCommandInput,
    options?: S3RequestOptions,
  ): Promise<PutObjectAnnotationCommandOutput>;
  putObjectAnnotation(
    args: PutObjectAnnotationCommandInput,
    cb: (err: any, data?: PutObjectAnnotationCommandOutput) => void,
  ): void;
  putObjectAnnotation(
    args: PutObjectAnnotationCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: PutObjectAnnotationCommandOutput) => void,
  ): void;
  putObjectLegalHold(
    args: PutObjectLegalHoldCommandInput,
    options?: S3RequestOptions,
  ): Promise<PutObjectLegalHoldCommandOutput>;
  putObjectLegalHold(
    args: PutObjectLegalHoldCommandInput,
    cb: (err: any, data?: PutObjectLegalHoldCommandOutput) => void,
  ): void;
  putObjectLegalHold(
    args: PutObjectLegalHoldCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: PutObjectLegalHoldCommandOutput) => void,
  ): void;
  putObjectLockConfiguration(
    args: PutObjectLockConfigurationCommandInput,
    options?: S3RequestOptions,
  ): Promise<PutObjectLockConfigurationCommandOutput>;
  putObjectLockConfiguration(
    args: PutObjectLockConfigurationCommandInput,
    cb: (err: any, data?: PutObjectLockConfigurationCommandOutput) => void,
  ): void;
  putObjectLockConfiguration(
    args: PutObjectLockConfigurationCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: PutObjectLockConfigurationCommandOutput) => void,
  ): void;
  putObjectRetention(
    args: PutObjectRetentionCommandInput,
    options?: S3RequestOptions,
  ): Promise<PutObjectRetentionCommandOutput>;
  putObjectRetention(
    args: PutObjectRetentionCommandInput,
    cb: (err: any, data?: PutObjectRetentionCommandOutput) => void,
  ): void;
  putObjectRetention(
    args: PutObjectRetentionCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: PutObjectRetentionCommandOutput) => void,
  ): void;
  putObjectTagging(
    args: PutObjectTaggingCommandInput,
    options?: S3RequestOptions,
  ): Promise<PutObjectTaggingCommandOutput>;
  putObjectTagging(
    args: PutObjectTaggingCommandInput,
    cb: (err: any, data?: PutObjectTaggingCommandOutput) => void,
  ): void;
  putObjectTagging(
    args: PutObjectTaggingCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: PutObjectTaggingCommandOutput) => void,
  ): void;
  putPublicAccessBlock(
    args: PutPublicAccessBlockCommandInput,
    options?: S3RequestOptions,
  ): Promise<PutPublicAccessBlockCommandOutput>;
  putPublicAccessBlock(
    args: PutPublicAccessBlockCommandInput,
    cb: (err: any, data?: PutPublicAccessBlockCommandOutput) => void,
  ): void;
  putPublicAccessBlock(
    args: PutPublicAccessBlockCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: PutPublicAccessBlockCommandOutput) => void,
  ): void;
  renameObject(
    args: RenameObjectCommandInput,
    options?: S3RequestOptions,
  ): Promise<RenameObjectCommandOutput>;
  renameObject(
    args: RenameObjectCommandInput,
    cb: (err: any, data?: RenameObjectCommandOutput) => void,
  ): void;
  renameObject(
    args: RenameObjectCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: RenameObjectCommandOutput) => void,
  ): void;
  restoreObject(
    args: RestoreObjectCommandInput,
    options?: S3RequestOptions,
  ): Promise<RestoreObjectCommandOutput>;
  restoreObject(
    args: RestoreObjectCommandInput,
    cb: (err: any, data?: RestoreObjectCommandOutput) => void,
  ): void;
  restoreObject(
    args: RestoreObjectCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: RestoreObjectCommandOutput) => void,
  ): void;
  selectObjectContent(
    args: SelectObjectContentCommandInput,
    options?: S3RequestOptions,
  ): Promise<SelectObjectContentCommandOutput>;
  selectObjectContent(
    args: SelectObjectContentCommandInput,
    cb: (err: any, data?: SelectObjectContentCommandOutput) => void,
  ): void;
  selectObjectContent(
    args: SelectObjectContentCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: SelectObjectContentCommandOutput) => void,
  ): void;
  updateBucketMetadataAnnotationTableConfiguration(
    args: UpdateBucketMetadataAnnotationTableConfigurationCommandInput,
    options?: S3RequestOptions,
  ): Promise<UpdateBucketMetadataAnnotationTableConfigurationCommandOutput>;
  updateBucketMetadataAnnotationTableConfiguration(
    args: UpdateBucketMetadataAnnotationTableConfigurationCommandInput,
    cb: (err: any, data?: UpdateBucketMetadataAnnotationTableConfigurationCommandOutput) => void,
  ): void;
  updateBucketMetadataAnnotationTableConfiguration(
    args: UpdateBucketMetadataAnnotationTableConfigurationCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: UpdateBucketMetadataAnnotationTableConfigurationCommandOutput) => void,
  ): void;
  updateBucketMetadataInventoryTableConfiguration(
    args: UpdateBucketMetadataInventoryTableConfigurationCommandInput,
    options?: S3RequestOptions,
  ): Promise<UpdateBucketMetadataInventoryTableConfigurationCommandOutput>;
  updateBucketMetadataInventoryTableConfiguration(
    args: UpdateBucketMetadataInventoryTableConfigurationCommandInput,
    cb: (err: any, data?: UpdateBucketMetadataInventoryTableConfigurationCommandOutput) => void,
  ): void;
  updateBucketMetadataInventoryTableConfiguration(
    args: UpdateBucketMetadataInventoryTableConfigurationCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: UpdateBucketMetadataInventoryTableConfigurationCommandOutput) => void,
  ): void;
  updateBucketMetadataJournalTableConfiguration(
    args: UpdateBucketMetadataJournalTableConfigurationCommandInput,
    options?: S3RequestOptions,
  ): Promise<UpdateBucketMetadataJournalTableConfigurationCommandOutput>;
  updateBucketMetadataJournalTableConfiguration(
    args: UpdateBucketMetadataJournalTableConfigurationCommandInput,
    cb: (err: any, data?: UpdateBucketMetadataJournalTableConfigurationCommandOutput) => void,
  ): void;
  updateBucketMetadataJournalTableConfiguration(
    args: UpdateBucketMetadataJournalTableConfigurationCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: UpdateBucketMetadataJournalTableConfigurationCommandOutput) => void,
  ): void;
  updateObjectEncryption(
    args: UpdateObjectEncryptionCommandInput,
    options?: S3RequestOptions,
  ): Promise<UpdateObjectEncryptionCommandOutput>;
  updateObjectEncryption(
    args: UpdateObjectEncryptionCommandInput,
    cb: (err: any, data?: UpdateObjectEncryptionCommandOutput) => void,
  ): void;
  updateObjectEncryption(
    args: UpdateObjectEncryptionCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: UpdateObjectEncryptionCommandOutput) => void,
  ): void;
  uploadPart(
    args: UploadPartCommandInput,
    options?: S3RequestOptions,
  ): Promise<UploadPartCommandOutput>;
  uploadPart(
    args: UploadPartCommandInput,
    cb: (err: any, data?: UploadPartCommandOutput) => void,
  ): void;
  uploadPart(
    args: UploadPartCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: UploadPartCommandOutput) => void,
  ): void;
  uploadPartCopy(
    args: UploadPartCopyCommandInput,
    options?: S3RequestOptions,
  ): Promise<UploadPartCopyCommandOutput>;
  uploadPartCopy(
    args: UploadPartCopyCommandInput,
    cb: (err: any, data?: UploadPartCopyCommandOutput) => void,
  ): void;
  uploadPartCopy(
    args: UploadPartCopyCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: UploadPartCopyCommandOutput) => void,
  ): void;
  writeGetObjectResponse(
    args: WriteGetObjectResponseCommandInput,
    options?: S3RequestOptions,
  ): Promise<WriteGetObjectResponseCommandOutput>;
  writeGetObjectResponse(
    args: WriteGetObjectResponseCommandInput,
    cb: (err: any, data?: WriteGetObjectResponseCommandOutput) => void,
  ): void;
  writeGetObjectResponse(
    args: WriteGetObjectResponseCommandInput,
    options: S3RequestOptions,
    cb: (err: any, data?: WriteGetObjectResponseCommandOutput) => void,
  ): void;
  paginateListBuckets(
    args?: ListBucketsCommandInput,
    paginationConfig?: Pick<
      PaginationConfiguration,
      Exclude<keyof PaginationConfiguration, "client">
    >,
  ): Paginator<ListBucketsCommandOutput>;
  paginateListDirectoryBuckets(
    args?: ListDirectoryBucketsCommandInput,
    paginationConfig?: Pick<
      PaginationConfiguration,
      Exclude<keyof PaginationConfiguration, "client">
    >,
  ): Paginator<ListDirectoryBucketsCommandOutput>;
  paginateListObjectAnnotations(
    args: ListObjectAnnotationsCommandInput,
    paginationConfig?: Pick<
      PaginationConfiguration,
      Exclude<keyof PaginationConfiguration, "client">
    >,
  ): Paginator<ListObjectAnnotationsCommandOutput>;
  paginateListObjectsV2(
    args: ListObjectsV2CommandInput,
    paginationConfig?: Pick<
      PaginationConfiguration,
      Exclude<keyof PaginationConfiguration, "client">
    >,
  ): Paginator<ListObjectsV2CommandOutput>;
  paginateListParts(
    args: ListPartsCommandInput,
    paginationConfig?: Pick<
      PaginationConfiguration,
      Exclude<keyof PaginationConfiguration, "client">
    >,
  ): Paginator<ListPartsCommandOutput>;
  waitUntilBucketExists(
    args: HeadBucketCommandInput,
    waiterConfig:
      | number
      | Pick<WaiterConfiguration<S3>, Exclude<keyof WaiterConfiguration<S3>, "client">>,
  ): Promise<WaiterResult<HeadBucketCommandOutput>>;
  waitUntilBucketNotExists(
    args: HeadBucketCommandInput,
    waiterConfig:
      | number
      | Pick<WaiterConfiguration<S3>, Exclude<keyof WaiterConfiguration<S3>, "client">>,
  ): Promise<WaiterResult<NotFound>>;
  waitUntilObjectExists(
    args: HeadObjectCommandInput,
    waiterConfig:
      | number
      | Pick<WaiterConfiguration<S3>, Exclude<keyof WaiterConfiguration<S3>, "client">>,
  ): Promise<WaiterResult<HeadObjectCommandOutput>>;
  waitUntilObjectNotExists(
    args: HeadObjectCommandInput,
    waiterConfig:
      | number
      | Pick<WaiterConfiguration<S3>, Exclude<keyof WaiterConfiguration<S3>, "client">>,
  ): Promise<WaiterResult<NotFound>>;
}
export declare class S3 extends S3Client implements S3 {}
