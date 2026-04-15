/**
 * 翻译 API 服务
 * 封装腾讯云翻译 API（TMT），支持单语言和全语言并发翻译
 */
import * as crypto from 'crypto';
import * as https from 'https';
import type { TranslationApiConfig, LanguageMapping } from '../config/types';
import type { TranslationResult } from '../types';

const TMT_API_HOST = 'tmt.tencentcloudapi.com';
const TMT_API_VERSION = '2018-03-21';

export class TranslationService {
  private config: TranslationApiConfig;

  constructor(config: TranslationApiConfig) {
    this.config = config;
  }

  updateConfig(config: TranslationApiConfig): void {
    this.config = config;
  }

  get isConfigured(): boolean {
    return !!(this.config.apiKey && this.config.apiSecret);
  }

  /**
   * 翻译文本到目标语言
   */
  async translate(text: string, targetLang: string, sourceLang?: string): Promise<string> {
    if (!this.isConfigured) {
      throw new Error('翻译 API 未配置，请先设置 apiKey 和 apiSecret');
    }

    const source = sourceLang || this.config.sourceLanguage || 'zh';
    const payload = {
      SourceText: text,
      Source: source,
      Target: targetLang,
      ProjectId: 0,
    };

    const result = await this.callTencentApi('TextTranslate', payload);
    return result.Response?.TargetText || '';
  }

  /**
   * 并发翻译到所有配置的语言
   */
  async translateToAllLanguages(
    text: string,
    key: string,
    mappings: LanguageMapping[],
    sourceLang?: string
  ): Promise<TranslationResult[]> {
    const source = sourceLang || this.config.sourceLanguage || 'zh';

    const tasks = mappings.map(async (mapping): Promise<TranslationResult> => {
      if (mapping.languageCode === source || mapping.languageCode.startsWith(source + '-')) {
        return { languageCode: mapping.languageCode, success: true, text };
      }

      try {
        const translated = await this.translate(text, mapping.languageCode, source);
        return { languageCode: mapping.languageCode, success: true, text: translated };
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        return { languageCode: mapping.languageCode, success: false, error: errMsg };
      }
    });

    return Promise.all(tasks);
  }

  /**
   * 将中文翻译为英文（用于键名生成）
   */
  async translateToEnglish(text: string): Promise<string> {
    return this.translate(text, 'en', 'zh');
  }

  /**
   * 调用腾讯云 API（TC3-HMAC-SHA256 签名）
   */
  private callTencentApi(action: string, payload: Record<string, unknown>): Promise<Record<string, any>> {
    return new Promise((resolve, reject) => {
      const timestamp = Math.floor(Date.now() / 1000);
      const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
      const body = JSON.stringify(payload);

      const hashedPayload = this.sha256(body);
      const httpMethod = 'POST';
      const canonicalUri = '/';
      const canonicalQueryString = '';
      const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${TMT_API_HOST}\nx-tc-action:${action.toLowerCase()}\n`;
      const signedHeaders = 'content-type;host;x-tc-action';

      const canonicalRequest = [
        httpMethod, canonicalUri, canonicalQueryString,
        canonicalHeaders, signedHeaders, hashedPayload,
      ].join('\n');

      const credentialScope = `${date}/tmt/tc3_request`;
      const stringToSign = [
        'TC3-HMAC-SHA256', String(timestamp),
        credentialScope, this.sha256(canonicalRequest),
      ].join('\n');

      const secretDate = this.hmacSha256(`TC3${this.config.apiSecret}`, date);
      const secretService = this.hmacSha256(secretDate, 'tmt');
      const secretSigning = this.hmacSha256(secretService, 'tc3_request');
      const signature = this.hmacSha256Hex(secretSigning, stringToSign);

      const authorization = `TC3-HMAC-SHA256 Credential=${this.config.apiKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

      const options: https.RequestOptions = {
        hostname: TMT_API_HOST,
        method: 'POST',
        path: '/',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Host': TMT_API_HOST,
          'X-TC-Action': action,
          'X-TC-Timestamp': String(timestamp),
          'X-TC-Version': TMT_API_VERSION,
          'X-TC-Region': this.config.region || 'ap-guangzhou',
          'Authorization': authorization,
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.Response?.Error) {
              reject(new Error(`[${parsed.Response.Error.Code}] ${parsed.Response.Error.Message}`));
            } else {
              resolve(parsed);
            }
          } catch {
            reject(new Error('解析 API 响应失败'));
          }
        });
      });

      req.on('error', (err) => reject(err));
      req.setTimeout(10000, () => { req.destroy(); reject(new Error('API 请求超时')); });
      req.write(body);
      req.end();
    });
  }

  private sha256(data: string): string {
    return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
  }

  private hmacSha256(key: string | Buffer, data: string): Buffer {
    return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
  }

  private hmacSha256Hex(key: string | Buffer, data: string): string {
    return crypto.createHmac('sha256', key).update(data, 'utf8').digest('hex');
  }
}
