<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('build_logs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('build_id')->constrained()->restrictOnDelete();
            $table->unsignedInteger('sequence');
            $table->string('level', 16)->default('info');
            $table->text('message');
            $table->timestamp('logged_at');
            $table->unique(['build_id', 'sequence']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::unprepared(<<<'SQL'
                CREATE OR REPLACE FUNCTION openbox_build_logs_append_only()
                RETURNS trigger AS $$
                BEGIN
                    RAISE EXCEPTION 'build_logs is append-only';
                END;
                $$ LANGUAGE plpgsql;
            SQL);

            DB::unprepared(<<<'SQL'
                CREATE TRIGGER build_logs_no_update
                BEFORE UPDATE OR DELETE ON build_logs
                FOR EACH ROW EXECUTE FUNCTION openbox_build_logs_append_only();
            SQL);
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::unprepared('DROP TRIGGER IF EXISTS build_logs_no_update ON build_logs;');
            DB::unprepared('DROP FUNCTION IF EXISTS openbox_build_logs_append_only();');
        }

        Schema::dropIfExists('build_logs');
    }
};
