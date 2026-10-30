<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('releases', function (Blueprint $table): void {
            $table->id();
            $table->string('version', 64);
            $table->string('channel', 16)->default('stable')->index();
            $table->string('codename', 64)->nullable();
            $table->string('status', 16)->default('draft')->index();
            $table->text('notes')->nullable();
            $table->jsonb('checksums')->nullable();
            $table->foreignId('iso_build_id')->nullable()->constrained('builds')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();

            $table->unique(['channel', 'version']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('releases');
    }
};
