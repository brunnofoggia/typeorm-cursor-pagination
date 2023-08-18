import { ObjectLiteral, ObjectType } from 'typeorm';

import _Paginator, { Order } from './Paginator';

export interface PagingQuery {
    afterCursor?: string;
    beforeCursor?: string;
    limit?: number;
    order?: Order | 'ASC' | 'DESC';
}

export interface PaginationOptions<Entity extends ObjectLiteral> {
    entity: ObjectType<Entity>;
    alias?: string;
    query?: PagingQuery;
    paginationKeys?: Extract<keyof Entity, string>[];
    Paginator?: typeof _Paginator<Entity>,
    getMethod?: string;
}

export function buildPaginator<Entity extends ObjectLiteral>(
    options: PaginationOptions<Entity>,
): _Paginator<Entity> {
    const Paginator = options.Paginator || _Paginator;
    const {
        entity,
        query = {},
        alias = entity.name.toLowerCase(),
        paginationKeys = ['id' as any],
    } = options;

    const paginator = new Paginator(entity, paginationKeys);

    if (options.getMethod) paginator.getMethod = options.getMethod;

    paginator.setAlias(alias);

    if (query.afterCursor) {
        paginator.setAfterCursor(query.afterCursor);
    }

    if (query.beforeCursor) {
        paginator.setBeforeCursor(query.beforeCursor);
    }

    if (query.limit) {
        paginator.setLimit(query.limit);
    }

    if (query.order) {
        paginator.setOrder(query.order as Order);
    }

    return paginator;
}
