<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Throwable;

class Setting extends Model
{
    /** @var list<string> */
    protected $fillable = ['key', 'value', 'is_encrypted', 'group'];

    protected function casts(): array
    {
        return [
            'is_encrypted' => 'boolean',
        ];
    }

    public static function get(string $key, mixed $default = null): mixed
    {
        try {
            $setting = Cache::rememberForever(
                'setting:'.$key,
                static fn (): ?self => static::query()->where('key', $key)->first()
            );
        } catch (Throwable) {
            $setting = static::query()->where('key', $key)->first();
        }

        if (! $setting instanceof self) {
            return $default;
        }

        return $setting->typedValue($default);
    }

    public static function put(string $key, mixed $value, bool $encrypted = false, string $group = 'general'): self
    {
        $setting = static::query()->updateOrCreate(
            ['key' => $key],
            [
                'value' => $encrypted
                    ? Crypt::encryptString(json_encode($value, JSON_THROW_ON_ERROR))
                    : json_encode($value, JSON_THROW_ON_ERROR),
                'is_encrypted' => $encrypted,
                'group' => $group,
            ]
        );

        Cache::forget('setting:'.$key);

        return $setting;
    }

    public static function forget(string $key): void
    {
        Cache::forget('setting:'.$key);
    }

    public function typedValue(mixed $default = null): mixed
    {
        if ($this->value === null) {
            return $default;
        }

        try {
            $payload = $this->is_encrypted
                ? Crypt::decryptString($this->value)
                : $this->value;

            return json_decode($payload, true, 512, JSON_THROW_ON_ERROR);
        } catch (Throwable) {
            return $default;
        }
    }
}
