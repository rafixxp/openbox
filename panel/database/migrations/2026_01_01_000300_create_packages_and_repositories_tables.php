<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('debian_packages', function (Blueprint $table): void {
            $table->id();
            $table->string('name')->index();
            $table->string('version', 128);
            $table->string('architecture', 32)->default('amd64');
            $table->string('channel', 16)->default('stable')->index();
            $table->string('component', 64)->default('main');
            $table->string('section', 64)->nullable();
            $table->text('description')->nullable();
            $table->jsonb('depends')->nullable();
            $table->jsonb('recommends')->nullable();
            $table->string('filename');
            $table->unsignedBigInteger('size')->default(0);
            $table->char('sha256', 64)->index();
            $table->string('status', 16)->default('uploaded')->index();
            $table->string('gpg_key_id', 64)->nullable();
            $table->longText('gpg_signature')->nullable();
            $table->jsonb('metadata')->nullable();
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['name', 'version', 'architecture', 'channel']);
        });

        Schema::create('repositories', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->string('slug', 64)->unique();
            $table->string('suite', 64)->default('bookworm');
            $table->jsonb('components')->nullable();
            $table->jsonb('architectures')->nullable();
            $table->string('base_url')->nullable();
            $table->string('signing_key_fingerprint', 64)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('repositories');
        Schema::dropIfExists('debian_packages');
    }
};
