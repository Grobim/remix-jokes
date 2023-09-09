import {
  type ActionArgs,
  json,
  type LoaderArgs,
  redirect,
  type V2_MetaFunction as MetaFunction,
} from "@vercel/remix";
import {
  isRouteErrorResponse,
  useLoaderData,
  useParams,
  useRouteError,
} from "@remix-run/react";
import { JokeDisplay } from "~/components/joke";

import { db } from "~/utils/db.server";
import { badRequest } from "~/utils/request.server";
import { getUserId } from "~/utils/session.server";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const { description, title } = data
    ? {
        description: `Enjoy the "${data.joke.name}" joke and much more`,
        title: `"${data.joke.name}" joke`,
      }
    : { description: "No joke found", title: "No joke" };

  return [
    { name: "description", content: description },
    { name: "twitter:description", content: description },
    { title },
  ];
};

export const loader = async ({ params, request }: LoaderArgs) => {
  const joke = await db.joke.findUnique({ where: { id: params.jokeId } });
  const userId = await getUserId(request);

  if (!joke) {
    throw new Response("What a joke! Not found.", {
      status: 404,
    });
  }

  return json({ joke, isOwner: userId === joke.jokesterId });
};

export const action = async ({ request, params }: ActionArgs) => {
  const form = await request.formData();

  if (form.get("intent") === "delete") {
    const joke = await db.joke.findUnique({
      where: { id: params.jokeId },
      select: { jokesterId: true },
    });

    if (!joke) {
      throw new Response("No joke to delete", { status: 404 });
    }

    const userId = await getUserId(request);

    if (userId !== joke.jokesterId) {
      throw new Response("Pssh, nice try. That's not your joke", {
        status: 403,
      });
    }

    await db.joke.delete({ where: { id: params.jokeId } });
    return redirect("/jokes");
  }

  return badRequest(Object.fromEntries(form));
};

export default function JokeRoute() {
  const { joke, isOwner } = useLoaderData<typeof loader>();

  return <JokeDisplay joke={joke} isOwner={isOwner} />;
}

export function ErrorBoundary() {
  const { jokeId } = useParams();
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return (
        <div className="error-container">Huh? What the heck is "{jokeId}"?</div>
      );
    }

    if (error.status === 403) {
      return (
        <div className="error-container">
          Sorry, but "{jokeId}" is not your joke.
        </div>
      );
    }

    if (error.status === 404) {
      return (
        <div className="error-container">Huh? What the heck is "{jokeId}"?</div>
      );
    }
  }

  return (
    <div className="error-container">
      There was an error loading joke by the id "{jokeId}". Sorry.
    </div>
  );
}
