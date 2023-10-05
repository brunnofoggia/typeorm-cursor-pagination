import { cloneDeep, defaults } from 'lodash';
import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { PaginationOptions, buildPaginator } from './buildPaginator';
import { Cursor } from './Paginator';

export enum DIRECTION {
    PREV = 'before',
    NEXT = 'after',
}

export class PaginatorUtil<Entity extends ObjectLiteral> {
    private options: PaginationOptions<Entity>;
    private queryBuilder: any;
    private cursors: Cursor | null = null;
    public data: any[] = [];

    constructor(options: PaginationOptions<Entity>, queryBuilder: SelectQueryBuilder<Entity>) {
        this.options = options;
        this.queryBuilder = queryBuilder;
    }

    getOptions() {
        return cloneDeep(this.options);
    }

    getCursorKey(type: DIRECTION) {
        return `${type}Cursor`;
    }

    getCursors() {
        return this.cursors;
    }

    setCursors(cursor: Cursor | null = null) {
        return this.cursors = cursor;
    }

    buildOptions(type: DIRECTION, cursor: Cursor | null = null) {
        const options = this.getOptions();
        if (cursor) {
            const key = this.getCursorKey(type);
            // @ts-ignore
            const value = cursor[key];

            /* end of pagination */
            if (!value) return null;

            const result: any = {};
            result[key] = value;
            options.query = defaults(result, options.query);
        }
        return options;
    }

    buildNextOptions() {
        return this.buildOptions(DIRECTION.NEXT, this.cursors);
    }

    buildPrevOptions() {
        return this.buildOptions(DIRECTION.PREV, this.cursors);
    }

    buildPaginator(options: PaginationOptions<Entity>) {
        return buildPaginator({ getMethod: 'getRawMany', ...options });
    }

    async goTo(options: PaginationOptions<Entity> | null) {
        if (!options) return this.end();

        const paginator = this.buildPaginator(options);
        // const queryBuilder = this.queryBuilderFn();
        const queryBuilder = this.queryBuilder;
        const { data, cursor } = await paginator.paginate(queryBuilder);

        this.cursors = cursor;
        this.data = data;
        return { data, cursor };
    }

    end() {
        const data: any[] = [];
        this.data = data;
        return { data };
    }

    setCursorByEntity(entity: Entity, type: DIRECTION = DIRECTION.NEXT) {
        const paginator = this.buildPaginator(this.getOptions());
        const cursor = paginator.encode(entity);

        return this.setCursorByDirection(cursor, type);
    }

    setCursorByDirection(cursor: string, type: DIRECTION = DIRECTION.NEXT) {
        const cursors: any = {};
        cursors[this.getCursorKey(type)] = cursor;

        return this.setCursors(cursors);
    }

    decodeCursor(cursor: string) {
        const paginator = this.buildPaginator(this.getOptions());
        return paginator.decode(cursor);
    }

    encodeCursor(entity: Entity) {
        const paginator = this.buildPaginator(this.getOptions());
        return paginator.encode(entity);
    }

    async next() {
        const options = this.buildNextOptions();
        return this.goTo(options);
    }

    async hasNext() {
        await this.next();
        return this.data.length > 0;
    }

    async prev() {
        const options = this.buildPrevOptions();
        return this.goTo(options);
    }

    async hasPrev() {
        await this.prev();
        return this.data.length > 0;
    }
}
