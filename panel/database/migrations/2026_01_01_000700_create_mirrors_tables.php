<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mirrors', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->string('base_url');
            $table->string('sync_target')->nullable();
            $table->string('region', 64)->nullable();
            $table->string('status', 16)->default('offline')->index();
            $table->boolean('is_primary')->default(false);
            $table->timestamp('last_synced_at')->nullable();
            $table->unsignedInteger('latency_ms')->nullable();
            $table->text('last_error')->nullable();
            $table->timestamps();
        });

        Schema::create('mirror_syncs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('mirror_id')->constrained()->cascadeOnDelete();
            $table->foreignId('release_id')->nullable()->constrained()->nullOnDelete();
            $table->string('status', 16)->default('queued')->index();
            $table->unsignedBigInteger('bytes_synced')->default(0);
            $table->text('error')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mirror_syncs');
        Schema::dropIfExists('mirrors');
    }
};
