<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('builds', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('status', 16)->default('queued')->index();
            $table->string('channel', 16)->default('stable')->index();
            $table->string('stage', 64)->nullable();
            $table->unsignedTinyInteger('progress')->default(0);
            $table->foreignId('requested_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('retry_of_id')->nullable()->constrained('builds')->nullOnDelete();
            $table->string('agent', 64)->nullable();
            $table->jsonb('manifest');
            $table->smallInteger('exit_code')->nullable();
            $table->text('error_message')->nullable();
            $table->string('artifact_disk', 32)->default('s3');
            $table->string('artifact_path')->nullable();
            $table->unsignedBigInteger('artifact_size')->nullable();
            $table->char('artifact_sha256', 64)->nullable();
            $table->string('idempotency_key', 128)->nullable()->unique();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->timestamp('canceled_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('builds');
    }
};
