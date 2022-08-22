/* eslint-disable camelcase */
import { statSync } from 'fs';
import { pick } from 'lodash';
import {
    BadRequestError, ForbiddenError, ValidationError,
} from '../error';
import { md5 } from '../lib/crypto';
import { PRIV } from '../model/builtin';
import * as oplog from '../model/oplog';
import storage from '../model/storage';
import * as system from '../model/system';
import user from '../model/user';
import {
    Handler, param, post, Route, Types,
} from '../service/server';
import { encodeRFC5987ValueChars } from '../service/storage';
import { builtinConfig } from '../settings';
import { sortFiles } from '../utils';

class SwitchLanguageHandler extends Handler {
    @param('lang', Types.Name)
    async get(domainId: string, lang: string) {
        if (this.user.hasPriv(PRIV.PRIV_USER_PROFILE)) {
            this.session.viewLang = lang;
            await user.setById(this.user._id, { viewLang: lang });
        } else this.session.viewLang = lang;
        this.back();
    }
}

export class FilesHandler extends Handler {
    @param('pjax', Types.Boolean)
    async get(domainId: string, pjax = false) {
        if (!this.user._files?.length) this.checkPriv(PRIV.PRIV_CREATE_FILE);
        const body = {
            files: sortFiles(this.user._files),
            urlForFile: (filename: string) => this.url('fs_download', { uid: this.user._id, filename }),
        };
        if (pjax) {
            this.response.body = {
                fragments: (await Promise.all([
                    this.renderHTML('partials/files.html', body),
                ])).map((i) => ({ html: i })),
            };
            this.response.template = '';
        } else {
            this.response.template = 'home_files.html';
            this.response.body = body;
        }
    }

    @post('filename', Types.Name, true)
    async postUploadFile(domainId: string, filename: string) {
        this.checkPriv(PRIV.PRIV_CREATE_FILE);
        if ((this.user._files?.length || 0) >= system.get('limit.user_files')) {
            if (!this.user.hasPriv(PRIV.PRIV_UNLIMITED_QUOTA)) throw new ForbiddenError('File limit exceeded.');
        }
        const file = this.request.files?.file;
        if (!file) throw new ValidationError('file');
        const f = statSync(file.filepath);
        const size = Math.sum((this.user._files || []).map((i) => i.size)) + f.size;
        if (size >= system.get('limit.user_files_size')) {
            if (!this.user.hasPriv(PRIV.PRIV_UNLIMITED_QUOTA)) throw new ForbiddenError('File size limit exceeded.');
        }
        if (!filename) filename = file.originalFilename || String.random(16);
        if (filename.includes('/') || filename.includes('..')) throw new ValidationError('filename', null, 'Bad filename');
        if (this.user._files.filter((i) => i.name === filename).length) throw new BadRequestError('file exists');
        await storage.put(`user/${this.user._id}/${filename}`, file.filepath, this.user._id);
        const meta = await storage.getMeta(`user/${this.user._id}/${filename}`);
        const payload = { name: filename, ...pick(meta, ['size', 'lastModified', 'etag']) };
        if (!meta) throw new Error('Upload failed');
        this.user._files.push({ _id: filename, ...payload });
        await user.setById(this.user._id, { _files: this.user._files });
        this.back();
    }

    @post('files', Types.Array)
    async postDeleteFiles(domainId: string, files: string[]) {
        await Promise.all([
            storage.del(files.map((t) => `user/${this.user._id}/${t}`), this.user._id),
            user.setById(this.user._id, { _files: this.user._files.filter((i) => !files.includes(i.name)) }),
        ]);
        this.back();
    }
}

export class FSDownloadHandler extends Handler {
    @param('uid', Types.Int)
    @param('filename', Types.Name)
    @param('noDisposition', Types.Boolean)
    async get(domainId: string, uid: number, filename: string, noDisposition = false) {
        const targetUser = await user.getById('system', uid);
        if (this.user._id !== uid && !targetUser.hasPriv(PRIV.PRIV_CREATE_FILE)) throw new ForbiddenError('Access denied');
        this.response.addHeader('Cache-Control', 'public');
        const target = `user/${uid}/${filename}`;
        const file = await storage.getMeta(target);
        await oplog.log(this, 'download.file.user', {
            target,
            size: file?.size || 0,
        });
        this.response.redirect = await storage.signDownloadLink(
            target, noDisposition ? undefined : filename, false, 'user',
        );
    }
}

export class StorageHandler extends Handler {
    @param('target', Types.Name)
    @param('filename', Types.Name, true)
    @param('expire', Types.UnsignedInt)
    @param('secret', Types.String)
    async get(domainId: string, target: string, filename = '', expire: number, secret: string) {
        const expected = md5(`${target}/${expire}/${builtinConfig.file.secret}`);
        if (expire < Date.now()) throw new ForbiddenError('Link expired');
        if (secret !== expected) throw new ForbiddenError('Invalid secret');
        this.binary(await storage.get(target), filename);
    }
}

export class SwitchAccountHandler extends Handler {
    @param('uid', Types.Int)
    async get(domainId: string, uid: number) {
        this.session.uid = uid;
        this.back();
    }
}

export async function apply() {
    Route('switch_language', '/language/:lang', SwitchLanguageHandler);
    Route('home_files', '/file', FilesHandler);
    Route('fs_download', '/file/:uid/:filename', FSDownloadHandler);
    Route('storage', '/storage', StorageHandler);
    Route('switch_account', '/account', SwitchAccountHandler, PRIV.PRIV_EDIT_SYSTEM);
}

global.Hydro.handler.misc = apply;
